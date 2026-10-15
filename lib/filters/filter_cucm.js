var base_filter = require('../lib/base_filter'),
  util = require('util'),
  csv = require('csv-parser'),
  {Readable} = require('stream'),
  logger = require('log4node');

function FilterCucm() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Cucm',
    optional_params: ['separator'],
    default_values: {
      separator: ',',
    },
    start_hook: this.start,
  });
  this.headers = null;
}

util.inherits(FilterCucm, base_filter.BaseFilter);

FilterCucm.prototype.start = function(callback) {
  logger.info('Initialized Cisco UCM CDR/CMR CSV parser');
  callback();
};

FilterCucm.prototype.parseLine = function(line, callback) {
  if (!this.headers) {
    return callback(new Error('CUCM header row not seen yet'));
  }
  var parser = csv({
    headers: this.headers,
    separator: this.separator,
  });
  parser.on('data', function(row) {
    callback(null, row);
  });
  parser.on('error', function(err) {
    callback(err);
  });
  Readable.from([line + '\n']).pipe(parser);
};

FilterCucm.prototype.process = function(data) {
  if (!data || !data.message) {
    return;
  }
  var line = data.message.toString().trim();
  if (line.length === 0) {
    return;
  }
  if (/^cdrRecordType/i.test(line)) {
    this.headers = line.split(this.separator).map(function(h) {
      return h.trim();
    });
    return;
  }
  if (!this.headers) {
    logger.warning('CUCM CSV row before header; skipping');
    return;
  }
  this.parseLine(line, function(err, row) {
    if (err) {
      logger.error('CUCM CSV parse error', err);
      return;
    }
    var out = {};
    for (var k in data) {
      if (k !== 'message') {
        out[k] = data[k];
      }
    }
    for (var key in row) {
      out[key] = row[key];
    }
    if (row.cdrRecordType === '2' || row.cdrRecordType === 2) {
      out.type = out.type || 'cucm_cmr';
    } else {
      out.type = out.type || 'cucm_cdr';
    }
    this.emit('output', out);
  }.bind(this));
};

FilterCucm.prototype.close = function(callback) {
  callback();
};

exports.create = function() {
  return new FilterCucm();
};
