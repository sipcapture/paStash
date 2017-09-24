/* 
   Custom, Unoptimized SONUS Log to SIP/HEP3 Parser w/ reassembly of rows 
   (C) 2017 QXIP BV
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var moment = require('moment');

function FilterAppSonus() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppSonus',
    optional_params: ['correlation_hdr'],
    default_values: {
      'correlation_hdr': 'Call-ID|Call-Id'
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppSonus, base_filter.BaseFilter);

FilterAppSonus.prototype.start = function(callback) {
  logger.info('Initialized App Sonus Log to SIP/HEP parser');
  callback();
};

var last = '';
var ipcache = {};
var hold = false;

FilterAppSonus.prototype.process = function(data) {

   var line = data.message;
   if (line.indexOf('sending from') !== -1) {
        var regex = /sending from \[(.*)\]:(.*) to \[(.*)\]:([^\s]+)/g;
        var ip = regex.exec(line);
	ipcache.srcIp = ip[1];
	ipcache.srcPort = ip[2];
	ipcache.dstIp = ip[3];
	ipcache.dstPort = ip[4];
	date_regex = /^\[(.*)\]\s/g;
        ipcache.xdate = moment(date_regex.exec(line)[1].split(',').join('.'), 'DD-MM-YYYY HH:mm:ss.SSS');
	console.log('out',ipcache);
   } else if (line.indexOf('Incoming message on') !== -1) {
        var regex = /Incoming message on \[(.*)\]:(.*) from \[(.*)\]:([^\s]+)/g;
        var ip = regex.exec(line);
	ipcache.srcIp = ip[3];
	ipcache.srcPort = ip[4];
	ipcache.dstIp = ip[1];
	ipcache.dstPort = ip[2];
	date_regex = /^\[(.*)\]\s/g;
        ipcache.xdate = moment(date_regex.exec(line)[1].split(',').join('.'), 'DD-MM-YYYY HH:mm:ss.SSS');
	console.log('in',ipcache);

   } else if (!line.startsWith("[") ) {

      if (line.length > 1) {
		last += line + '\n';
		return;
      } else {
		last+= line + '\n';
		var sip = last;
		last = '';
      }

      console.log('full:',sip);

      var ts = ipcache.xdate.unix();
      var ts_usec = ipcache.xdate.millisecond() * 1000;

         var rcinfo = {
              type: 'HEP',
              version: 3,
              payload_type: 1,
              ip_family: 2,
              protocol: 6,
              proto_type: 1,
              correlation_id: '',
              srcIp: ipcache.srcIp,
              srcPort: ipcache.srcPort,
              dstIp: ipcache.dstIp,
              dstPort: ipcache.dstPort,
              time_sec: ts || '',
              time_usec: ts_usec || ''
            };

	 // EXTRACT CORRELATION HEADER, IF ANY
	 if (this.correlation_hdr) {
		var xcid = sip.match(this.correlation_hdr+":\s?(.*)\\r");
		if (xcid && xcid[1]) rcinfo.correlation_id = xcid[1].trim();
	 }
         if (sip && rcinfo) {
           return { payload: sip, rcinfo: rcinfo };
         }

   }
};

exports.create = function() {
  return new FilterAppSonus();
};
