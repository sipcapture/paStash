/* 
   Custom, Unoptimized AVAYA Log to SIP/HEP3 Parser w/ reassembly of rows 
   (C) 2017 QXIP BV
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var moment = require('moment');

function FilterAppAvaya() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppAvaya',
    optional_params: ['correlation_hdr'],
    default_values: {
      'correlation_hdr': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppAvaya, base_filter.BaseFilter);

FilterAppAvaya.prototype.start = function(callback) {
  logger.info('Initialized App Avaya Log to SIP/HEP parser');
  callback();
};

var last;
var hold = false;

FilterAppAvaya.prototype.process = function(data) {

   var line = data.message;
   if (line.indexOf('SIPMSGT+') !== -1) {
	  line = line.replace(/#015#012/g, '\r\n');
	  line = line.replace(/>#012</g, '\n');
	  line = line.replace(/#012--------------------/g, '');
          if (last) last += line.split(/SIPMSGT\+ /)[1];
   } else if (line.indexOf('SIPMSGT #012') !== -1) {
      var full = line.split(/SIPMSGT #012--------------------#012/)[1];
      if (!full) { return; }
      if (!hold) { last = full; hold = true; return; }
      // RELEASE BUFFER
      full = last;
      hold = false;
      
      // SANITIZE KNOWN ELEMENTS
      full = full.replace(/#015#012/g, '\r\n');
      full = full.replace(/#011|-->|<--|#012--------------------/g, '');
      
      // SPLIT FIELDS
      var split = full.split(/#012/);
      // FORM TIMESTAMPS
      var xdate = moment(split[0], 'DD/MM/YYYY HH:mm:ss.SSS');
      var ts = xdate.unix();
      var ts_usec = xdate.millisecond() * 1000;
      // var ts_usec = xdate.millisecond();

      // IP DATAGRAM
      var regex = /L(.*):(.*[0-9])\/R(.*):(.*[0-9])\/(.*)\//g;
      var egress_regex = /L(.*):(.*[0-9])\/R(.*):(.*[0-9])\/(.*)\//g;
      while (( ip = regex.exec(split[2])) !== null) {
         if (split[3]) { var remote = egress_regex.exec(split[3]);
         } else { var remote = false; }
         var rcinfo = {
              type: 'HEP',
              version: 3,
              payload_type: 1,
              ip_family: 2,
              protocol: ip[5] == 'UDP' ? 17 : 6,
              proto_type: 1,
              correlation_id: '',
              srcIp: ip[3],
              srcPort: ip[4],
              dstIp: remote ? remote[3] : ip[1],
              dstPort: remote ? remote[4] : ip[2],
              time_sec: ts,
              time_usec: ts_usec
            };

         var sip = split[split.length-1];
	 // EXTRACT CORRELATION HEADER, IF ANY
	 if (this.correlation_hdr) {
		var xcid = sip.match(this.correlation_hdr+":\s?(.*)\\r");
		if (xcid && xcid[1]) rcinfo.correlation_id = xcid[1].trim();
	 }
         if (sip && rcinfo && ip) {
           return { payload: sip, rcinfo: rcinfo };
         }
      }
      // INIT NEW BLOCK
      last = line.split(/SIPMSGT /)[1];
   }
};

exports.create = function() {
  return new FilterAppAvaya();
};
