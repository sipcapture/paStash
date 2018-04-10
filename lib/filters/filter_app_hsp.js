/* 
   HEPIC HSP Pre-Processor v.1.01
   HSP is a float aware Bencode-like protocol by QXIP BV
   (C) 2017 QXIP BV, Lorenzo Mangani

   Changelog:

	- 07/09/2017: IP Grouping via HEPIC API hooks
	- 06/09/2017: CDR Pseudo rating via local SQLITE db
	- 04/09/2017: HSP/bencodefloat parsing
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var omit = require('object.omit');
var Bencode = require('@qxip/bencode');
var sqlite3 = require('sqlite3');
var sqlite;

var qrelate = require('qrelate');
/* vectors */
const vectors = [
  { score: 100, key: 'callid', suffix: "_b2b-1" },
  { score: 100, key: 'correlation_id', name: 'callid' },
  { score: 100, key: 'x-cid', name: 'callid' },
  { score: 50,  key: 'ruri_user', regex: /^(00|\+)/ },
  { score: 50,  key: 'from_user', regex: /^(00|\+)/ },
  { score: 50,  key: 'bnumber_ext' },
  { score: 50,  key: 'anumber_ext' }
];
qrelate.vectors(vectors);



var http = require('http');

var ip2int = function(ip) {
	//    return ip.split('.').reduce(function(ipInt, octet) { return (ipInt<<8) + parseInt(octet, 10)}, 0) >>> 0;
	var result = 0;
	iparr = ip.split('.');
	for (var i = 0; i < iparr.length; i++) {
		var pow = 3 - i;
		result += parseInt( parseInt(iparr[i]) * Math.pow(256, pow));
	}
	return result;
};


function FilterAppHsp() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppHsp',
    optional_params: ['correlation_hdr', 'sqlite_db','default_cc','strip_local','strip_dialprefix','strip_testuser','hepic_port','hepic_path', 'hepic_token','hepic_host', 'groupby', 'omit', 'links', 'links_size', 'links_age', 'links_vectors'],
    default_values: {
      'links': false,
      'correlation_hdr': 'Call-ID|Call-Id',
      'default_cc': '31',
      'strip_local': /^0[1-9]/,
      'strip_dialprefix': /^00/,
      'strip_testuser': /^5000/,
      'hepic_token': '123456',
      'hepic_host': '127.0.0.1',
      'hepic_port': 8087,
      'hepic_path': '/api/v2/admin/groupip',
      'groupby': 'source'
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

  if (this.hepic_token){
	  var http_options = {
	      host: this.hepic_host,
	      port: this.hepic_port,
	      path: this.hepic_path,
	      method: 'GET',
	      headers: {
	        'Content-Type': 'application/json',
		'PCAPTUREAUTH': this.hepic_token
	      }
	  };

	  var res = http.get(http_options, function(res) {
	    res.setEncoding('utf-8');  
	    var responseString = '';
	    res.on('data', function(data) {
	      responseString += data;
	    }.bind(this));
	    res.on('end', function() {
		this.IpGROUP = JSON.parse(responseString);
	    }.bind(this));
	  }.bind(this));
  }

  /* Initialize Cache */
  if(this.links) {
  	if(this.links_vectors) qrelate.vectors(this.links_vectors);
  	if(this.links_size) qrelate.params('maxSize', parseInt(this.links_size));
  	if(this.links_age) qrelate.params('maxAge', parseInt(this.links_age));
	logger.info('Initialized QRELATE Engine');
  }

  logger.info('Initialized App HSP');
  callback();
};

var callStatus = [ "NULL", "INIT", "UNAUTHORIZED", "PROGRESS", "RINGING", "CONNECTED", "MOVED", "USER_BUSY",
		   "USER_FAILURE", "HARD_FAILURE", "FINISHED", "CANCELED", "TIMEOUT_TERMINATED", "BAD_TERMINATED", "DECLINE",
		   "UNKNOWN_TERMINATED"];

FilterAppHsp.prototype.close = function(callback) {
  logger.info('Closing App HSP');
  callback();
}

FilterAppHsp.prototype.process = function(raw) {

	if (!raw.message) return;
	try {

	    if (raw.message.startsWith('d3:')){
                raw.message = Bencode.decode(raw.message, 'utf8');
		if (this.omit) raw.message = omit(raw.message, this.omit);

		return raw.message;
	    }

	    if (raw.message.startsWith('cdr')){

		// CDR Timestamp
		// raw.message.ts = raw['\@timestamp'];

		// CDR Decoding
		var tmp = 'd'+raw.message.slice(3)+'e';
		raw.message = Bencode.decode(tmp, 'utf8');

		// In-Memory Correlation
		if (this.links) try { raw.message = qrelate.process(raw.message) || raw.message; } catch(e) {};

		// OMIT Fields
		if (this.omit) raw.message = omit(raw.message, this.omit);

		// CDR Duration
		if (raw.message.cdr_stop > 0) raw.message.duration = parseInt( (raw.message.cdr_stop / 1000) - (raw.message.cdr_connect / 1000) || 0 );

		// CDR Status
		if (raw.message.status) raw.message.status_text = callStatus[raw.message.status];

		// CDR GEOobject
		if (raw.message.geo_lat) raw.message.geopoint = raw.message.geo_lat + ',' + raw.message.geo_lan;
		if (raw.message.dest_lat) raw.message.destpoint = raw.message.dest_lat + ',' + raw.message.dest_lan;


		// CDR Grouping from cache
		raw.message.group = raw.message.ipgroup || 'default';
			if(this.groupby && !raw.message.ipgroup){
				var ip = {};
				if (this.groupby == 'source'||this.groupby == '' && raw.message.source_ip){
					ip.int = ip2int(raw.message.source_ip);
					ip.ip = raw.message.source_ip;
				} else if (this.groupby == 'destination' && raw.message.destination_ip){
					ip.int = ip2int(raw.message.destination_ip);
					ip.ip = raw.message.destination_ip;
				} else if (this.groupby == 'media' && raw.message.sdmedia_ip){
					ip.int = ip2int(raw.message.sdmedia_ip);
					ip.ip = raw.message.sdmedia_ip;
				}
				for (var key in this.IpGROUP.data) {
					if( this.IpGROUP.data[key].active && (this.IpGROUP.data[key].ip == ip.ip ||
						( this.IpGROUP.data[key].ipbegin < ip.int && this.IpGROUP.data[key].ipend > ip.int))){
						raw.message.group = this.IpGROUP.data[key].name;
					} 
				}
			}

		// CDR Rating
		if (this.sqlite_db && raw.message.duration > 0 && raw.message.ruri_user) {

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
					this.emit('output', raw.message);
				}
			}.bind(this));
		
		} else { return raw.message; }

	    }  else { return raw.message; }

	} catch(e) { console.log('ERROR:',e); return raw.message; }

};

exports.create = function() {
  return new FilterAppHsp();
};
