/* 
   HEPIC HSP Pre-Processor
   HSP is a float aware Bencode-like protocol by QXIP BV
   (C) 2017 QXIP BV
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var Bencode = require('bencode');
var sqlite3 = require('sqlite3');
var sqlite;

function FilterAppHsp() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppHsp',
    optional_params: ['correlation_hdr', 'sqlite_db','default_cc','strip_local','strip_dialprefix','strip_testuser'],
    default_values: {
      'correlation_hdr': 'Call-ID|Call-Id',
      'default_cc': '31',
      'strip_local': /^0[1-9]/,
      'strip_dialprefix': /^00/,
      'strip_testuser': /^5000/
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppHsp, base_filter.BaseFilter);

FilterAppHsp.prototype.start = function(callback) {
  if (this.sqlite_db) { 
	sqlite = new sqlite3.cached.Database(this.sqlite_db);
  	logger.info('Initializing App HSP SQLITE:',this.sqlite_db);
  }
  if (this.strip_local) { 
	this.strip_local = new RegExp(this.strip_local); 
  	logger.info('Initializing App HSP RegExp:',this.strip_local);
  } 
  if (this.strip_dialprefix) { 
	this.strip_dialprefix = new RegExp(this.strip_dialprefix); 
  	logger.info('Initializing App HSP RegExp:',this.strip_dialprefix);
  } 
  if (this.strip_testuser) { 
	this.strip_testuser = new RegExp(this.strip_testuser); 
  	logger.info('Initializing App HSP RegExp:',this.strip_testuser);
  } 

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

		// CDR Timestamp
		raw.message.timestamp = (new Date()).getUTCMilliseconds();

		// CDR Decoding
		var tmp = 'd'+raw.message.slice(3)+'e';
		raw.message = Bencode.decode(tmp, 'utf8');

		// CDR Grouping
		raw.message.group = raw.message.ipgroup || 'default';

		// CDR Duration
		if (raw.message.cdr_stop > 0) raw.message.duration = parseInt( (raw.message.cdr_stop / 1000) - (raw.message.cdr_connect / 1000) || 0 );

		// CDR Status
		if (raw.message.status) raw.message.status_text = callStatus[raw.message.status];

		// CDR GEOobject
		if (raw.message.geo_lat) raw.message.geopoint = raw.message.geo_lat + ',' + raw.message.geo_lan;
		if (raw.message.dest_lat) raw.message.destpoint = raw.message.dest_lat + ',' + raw.message.dest_lan;

		// CDR Rating
		if (this.sqlite_db && raw.message.duration > 0) { 

			var bnumber = raw.message.ruri_user;
			var country = this.default_cc;

			try {
				bnumber = bnumber.replace(this.strip_local, country + "\$1");
				bnumber = bnumber.replace(this.strip_prefix, "");
				bnumber = bnumber.replace(this.strip_testuser, country);
				bnumber = bnumber.replace(/^([A-Za-z])/, country);
			} catch(e) {}

			if (bnumber.length > 6) bnumber = bnumber.trim(0,6);

			var table = 'prices_'+bnumber.trim(0, 2);

			var query = "SELECT price,country,description FROM "+table+" WHERE dest_prefix = "+bnumber;
			sqlite.get(query, function(err, row) {
				if (!row) return raw;
				else {
					raw.message.d_description = row.description;
					raw.message.d_total_cost = ((raw.message.duration * row.price) / 60) / 100;
					raw.message.d_country = row.country;
					raw.message.d_prefix = bnumber;
					raw.message.d_price = row.price;
					// Ship Back!
					this.emit('output', raw);
				}
			}.bind(this));
		
		} else { return raw; }
	    }

	} catch(e) { console.log('ERROR:',e); raw.raw = true; return raw; }

};

exports.create = function() {
  return new FilterAppHsp();
};
