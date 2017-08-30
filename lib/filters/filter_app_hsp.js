/* 
   HEPIC HSP Pre-Processor
   HSP is a float aware Bencode-like protocol by QXIP BV
   (C) 2017 QXIP BV
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var Bencode = require('bencode');

function FilterAppHsp() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppHsp',
    optional_params: ['correlation_hdr'],
    default_values: {
      'correlation_hdr': 'Call-ID|Call-Id'
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppHsp, base_filter.BaseFilter);

FilterAppHsp.prototype.start = function(callback) {
  logger.info('Initialized App HSP');
  callback();
};

var callStatus = [ "NULL", "INIT", "UNAUTHORIZED", "PROGRESS", "RINGING", "CONNECTED", "MOVED", "USER_BUSY",
		   "USER_FAILURE", "HARD_FAILURE", "FINISHED", "CANCELED", "TIMEOUT_TERMINATED", "BAD_TERMINATED", "DECLINE",
		   "UNKNOWN_TERMINATED"];

FilterAppHsp.prototype.process = function(raw) {

	if (!raw.message) return;
	try {

	    if (raw.message.startsWith('cdr')){

		// CDR Decoding
		var tmp = 'd'+raw.message.slice(3)+'e';
		raw.message = Bencode.decode(tmp, 'utf8');

		// CDR Grouping
		raw.message.group = raw.message.ipgroup || 'default';

		// CDR Duration
		if (raw.message.cdr_stop > 0) raw.message.duration = (raw.message.cdr_stop / 1000) - (raw.message.cdr_connect / 1000);

		// CDR Status
		if (raw.message.status) raw.message.status_text = callStatus[raw.message.status];

		// CDR GEOobject
		if (raw.message.geo_lat) raw.message.geopoint = raw.message.geo_lat + ',' + raw.message.geo_lan;
		if (raw.message.dest_lat) raw.message.destpoint = raw.message.dest_lat + ',' + raw.message.dest_lan;

		return raw;
	    }

	} catch(e) { console.log('ERROR:',e); return raw; }

};

exports.create = function() {
  return new FilterAppHsp();
};
