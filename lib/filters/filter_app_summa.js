/* 
   Custom SUMMA Event to SIP/HEP3 Parser w/ reassembly of rows, ips and correlation
   (C) 2017 QXIP BV
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

function FilterAppSumma() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppSumma',
    optional_params: ['debug', 'proto_type'],
    default_values: {
      'debug': false,
      'proto_type': 100
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppSumma, base_filter.BaseFilter);

FilterAppSumma.prototype.start = function(callback) {
  logger.info('Initialized App SUMMA to SIP/HEP parser');
  callback();
};

var kill = function(msg){
	if (this.debug) logger.info(msg);
}

var last = '';
var ipcache = {};
var hold = false;
FilterAppSumma.prototype.process = function(data) {

  try {
      var summa = data.message;

      var dnow = new Date();
      var ts = dnow.getTime();
      var ts_usec = dnow.getMilliseconds() * 1000;

      var datenow = new Date().getTime();
      var ts = Math.floor( datenow / 1000);
      var ts_usec = datenow - (ts*1000);
      
      var parsed = JSON.parse(data.message);
      if (!parsed) { kill(data); return; }
      var hosts = {
	source: parsed.source.host ? parsed.source.host.split(':') : ['10.0.0.1', 0],
        destination: parsed.destination.host ? parsed.destination.host.split(':') : ['10.0.0.2', 0]
      }
      var cid = '';
      if (parsed.content && parsed.content['sip-call-id']){ cid = parsed.content['sip-call-id']; }
      else if (parsed.origin && parsed.origin.session_id){ cid = parsed.origin.session_id; }
      else if (parsed.destination && parsed.destination.session_id){ cid = parsed.destination.session_id; }
      else if (parsed.source && parsed.source.session_id){ cid = parsed.source.session_id; }
      if (cid == '') {
		return;
      }

         var rcinfo = {
              type: 'HEP',
              version: 3,
              payload_type: 100,
              ip_family: 2,
              protocol: 6,
              proto_type: this.proto_type || 100,
              correlation_id: cid,
              srcIp: hosts.source[0],
              srcPort: hosts.source[1],
              dstIp: hosts.destination[0],
              dstPort: hosts.destination[1],
              time_sec: ts || '',
              time_usec: ts_usec || ''
            };

           if (this.debug) logger.info(rcinfo.correlation_id);
           return { payload: summa, rcinfo: rcinfo };

   } catch(e){ if (this.debug) logger.info(e); return; }
};

exports.create = function() {
  return new FilterAppSumma();
};
