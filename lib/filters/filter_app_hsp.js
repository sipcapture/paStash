/*
   HEPIC HSP Pre-Processor v.1.03

   Supports:
   - Legacy HSP/Bencode messages
   - JSON CDR events received through HEPIC WebSocket
   - JSON and CSV file output
   - Configurable include and omit fields for both formats
   
   include: Keep only specified fields.
   omit: Remove specified fields.
   If both are configured, include is applied first, then omit.

   Original JSON event values are preserved.
   No event filtering based on action or status.
*/

var base_filter = require('@pastash/pastash').base_filter,
    util = require('util'),
    logger = require('@pastash/pastash').logger;

var omit = require('object.omit');
var Bencode = require('@qxip/bencode');
var qrelate = require('qrelate');
var fs = require('fs');

/* ---------------- CSV Helpers ---------------- */

let csvHeaderWritten = false;
let csvFields = [];

function escapeCSV(value) {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    value = JSON.stringify(value);
  }

  value = String(value).replace(/"/g, '""');

  return '"' + value + '"';
}

function writeCSV(filePath, obj) {
  var fields = Object.keys(obj);

  if (!csvHeaderWritten) {
    csvFields = fields.slice();
    fs.appendFileSync(filePath, csvFields.join(',') + '\n');
    csvHeaderWritten = true;
  } else {
    // Add newly encountered fields to the CSV header.
    var newFields = fields.filter(function(field) {
      return csvFields.indexOf(field) === -1;
    });

    if (newFields.length) {
      csvFields = csvFields.concat(newFields);

      var existingContent = fs.readFileSync(filePath, 'utf8');
      var lines = existingContent.split('\n');

      // Rewrite the header and existing rows with the expanded columns.
      var oldFields = lines[0] ? lines[0].split(',') : [];
      var rewritten = [csvFields.join(',')];

      for (var i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;

        var values = lines[i].split(',');
        var row = [];

        csvFields.forEach(function(field) {
          var index = oldFields.indexOf(field);
          row.push(index >= 0 ? values[index] : '');
        });

        rewritten.push(row.join(','));
      }

      fs.writeFileSync(filePath, rewritten.join('\n') + '\n');
    }
  }

  var line = csvFields.map(function(field) {
    return escapeCSV(obj[field]);
  }).join(',');

  fs.appendFileSync(filePath, line + '\n');
}

function writeJSON(filePath, obj, pretty) {
  var line = pretty
    ? JSON.stringify(obj, null, 2)
    : JSON.stringify(obj);

  fs.appendFileSync(filePath, line + '\n');
}

/* ---------------- Output Helper ---------------- */

function writeOutput(filter, obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Include: retain only configured fields.
  if (filter.include && filter.include.length) {
    var selected = {};

    filter.include.forEach(function(field) {
      if (Object.prototype.hasOwnProperty.call(obj, field)) {
        selected[field] = obj[field];
      }
    });

    obj = selected;
  }

  // Omit: remove configured fields.
  if (filter.omit && filter.omit.length) {
    obj = omit(obj, filter.omit);
  }

  // Write filtered event.
  if (filter.file_path) {
    if (filter.output_format === 'csv') {
      writeCSV(filter.file_path, obj);
    } else {
      writeJSON(filter.file_path, obj, filter.pretty_json);
    }
  }

  return obj;
}

/* ---------------- Utils ---------------- */

var ip2int = function(ip) {
  var result = 0;
  var iparr = ip.split('.');

  for (var i = 0; i < iparr.length; i++) {
    result += parseInt(iparr[i]) * Math.pow(256, 3 - i);
  }

  return result;
};

/* ---------------- Filter ---------------- */

function FilterAppHsp() {
  base_filter.BaseFilter.call(this);

  this.mergeConfig({
    name: 'AppHsp',

    optional_params: [
      'correlation_hdr', 'default_cc', 'strip_local',
      'strip_dialprefix', 'strip_testuser', 'hepic_port',
      'hepic_path', 'hepic_token', 'hepic_host',
      'groupby', 'omit', 'include', 'links',
      'links_size', 'links_age', 'links_threshold',
      'links_vectors', 'file_path', 'pretty_json',
      'output_format'
    ],

    default_values: {
      links: false,
      default_cc: '31',
      strip_local: /^0[1-9]/,
      strip_dialprefix: /^00/,
      strip_testuser: /^5000/,
      hepic_api: false,
      hepic_token: '123456',
      hepic_host: '127.0.0.1',
      hepic_port: 8087,
      hepic_path: '/api/v2/admin/groupip',
      groupby: 'source',
      file_path: '/var/log/hepic/hepic_filtered.json',
      pretty_json: false,
      output_format: 'json'
    },

    start_hook: this.start
  });
}

util.inherits(FilterAppHsp, base_filter.BaseFilter);

/* ---------------- Start ---------------- */

FilterAppHsp.prototype.start = function(callback) {
  logger.info(
    'Initialized App HSP with output_format:',
    this.output_format
  );

  if (this.include && this.omit) {
    logger.info('Both include and omit configured; include will be applied first');
  }

  if (
    this.output_format === 'csv' &&
    !this.file_path.endsWith('.csv')
  ) {
    logger.warn('CSV output selected but file extension is not .csv');
  }

  callback();
};

/* ---------------- Close ---------------- */

FilterAppHsp.prototype.close = function(callback) {
  logger.info('Closing App HSP');
  callback();
};

/* ---------------- Process ---------------- */

FilterAppHsp.prototype.process = function(raw) {
  if (!raw.message) return;

  try {
    // HEPIC WebSocket JSON:
    // Parse the JSON but do not modify its original values.
    if (
      typeof raw.message === 'string' &&
      raw.message.trim().startsWith('{')
    ) {
      var event = JSON.parse(raw.message);

      return writeOutput(this, event);
    }

    // Legacy HSP/Bencode messages.
    if (raw.message.startsWith('d3:')) {
      raw.message = Bencode.decode(raw.message, 'utf8');

      return writeOutput(this, raw.message);
    }

    // Legacy CDR Bencode messages.
    if (raw.message.startsWith('cdr')) {
      var tmp = 'd' + raw.message.slice(3) + 'e';

      raw.message = Bencode.decode(tmp, 'utf8');

      if (this.links) {
        try {
          raw.message = qrelate.process(raw.message) || raw.message;
        } catch (e) {
          logger.error('Qrelate processing error:', e);
        }
      }

      // Retain the original legacy duration calculation.
      if (raw.message.cdr_stop > 0) {
        raw.message.duration = parseInt(
          (raw.message.cdr_stop / 1000) -
          (raw.message.cdr_connect / 1000) || 0
        );
      }

      return writeOutput(this, raw.message);
    }

    return raw.message;

  } catch (e) {
    logger.error('AppHSP ERROR:', e);
    return raw.message;
  }
};

/* ---------------- Export ---------------- */

exports.create = function() {
  return new FilterAppHsp();
};
