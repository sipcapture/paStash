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
    host_field: 'field',
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

FilterAppAvaya.prototype.process = function(line) {

   if (line.indexOf('SIPMSGT+') !== -1) {
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
      var ts_usec = xdate.millisecond();
      // IP DATAGRAM
      var regex = /L(.*):(.*[0-9])\/R(.*):(.*[0-9])\/(.*)\//g;
      while (( ip = regex.exec(split[2])) !== null) {
        var rcinfo = {
              type: 'HEP',
              version: 3,
              payload_type: 1,
              ip_family: 2,
              protocol: 17,
              proto_type: 1,
              correlation_id: '',
              srcIp: ip[1],
              dstIp: ip[3],
              srcPort: ip[2],
              dstPort: ip[4],
              time_sec: ts,
              time_usec: ts_usec
            };

        var sip = split[split.length-1];
        if (sip && ip[1]) {
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
