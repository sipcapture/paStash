/*
   Custom, Unoptimized Audiocodes Log to SIP/HEP3 Parser w/ reassembly of rows
   (C) 2020 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var moment = require('moment');

function FilterAppAudiocodes() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppAudiocodes',
    optional_params: ['correlation_hdr','type'],
    default_values: {
      'correlation_hdr': false,
      'type': 0
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppAudiocodes, base_filter.BaseFilter);

FilterAppAudiocodes.prototype.start = function(callback) {
logger.info('Initialized App Audiocodes SysLog to SIP/HEP parser');
  this.postProcess = function(ipcache,last){
	 if(!last||!ipcache) return;
         var rcinfo = {
              type: 'HEP',
              version: 3,
              payload_type: 1,
              ip_family: 2,
              protocol: 17,
              proto_type: 1,
              correlation_id: ipcache.callId || '',
              srcIp: ipcache.srcIp,
              srcPort: ipcache.srcPort,
              dstIp: ipcache.dstIp,
              dstPort: ipcache.dstPort,
              time_sec: ipcache.ts || new Date().getTime(),
              time_usec: ipcache.usec || 000
            };

	 // EXTRACT CORRELATION HEADER, IF ANY
	 /*
	 if (this.correlation_hdr) {
		var xcid = sip.match(this.correlation_hdr+":\s?(.*)\\r");
		if (xcid && xcid[1]) rcinfo.correlation_id = xcid[1].trim();
	 }
	 */

	 if (last.indexOf('2.0/TCP') !== -1 || last.indexOf('2.0/TLS') !== -1 ){
		rcinfo.protocol = 6;
         }

         if (last && rcinfo) {
           var data = { payload: payload, rcinfo: rcinfo };
	   this.emit('output', data);
	   payload = '';
	   ipcache = {};
         }
  }
  callback();
};

var last = '';
var ipcache = {};

FilterAppAudiocodes.prototype.process = function(data) {

   var line = data.message;

   if (line.indexOf('Incoming SIP Message') !== -1) {
	   var regex = /(.*)---- Incoming SIP Message from (.*) from SIPInterface #[0-99] \((.*)\) (.*) TO.*--- \\n(.*)\\n \\n \\n(.*) \[Time:(.*)-(.*)@(.*)\]/;
	   var ip = regex.exec(line);
	   if (!ip) { logger.error(line); return; }
	   logger.log('receive',ipcache);
	   if (ip[3]) {
		   var alias = this[ip[3]].split(':');
		   ipcache.dstIp = alias[0] || '127.0.0.1';
		   ipcache.dstPort = alias[1] || 5060;
	   }
	   ipcache.srcIp = ip[2].split(':')[0];
	   ipcache.srcPort = ip[2].split(':')[1];
	   ipcache.ts =  parseInt(new Date(ip[1].trim()).getTime()/1000);
	   ipcache.usec = parseInt(ip[1].split('.')[1])
	   last = ip[5];
   	   last += line + '\n\n';
	   var callid = \Call-ID: (.*)\\n\.exec(last);
	   ipcache.callId = callid;
	   logger.info('inbound',ipcache);
	   this.postProcess(ipcache,last);

   } else if (line.indexOf('Outgoing SIP Message') !== -1) {
	   var regex = /(.*)---- Outgoing SIP Message to (.*) from SIPInterface #[0-99] \((.*)\) (.*) TO.*--- \\n(.*)\\n \\n \\n(.*) \[Time:(.*)-(.*)@(.*)\]/;
	   var ip = regex.exec(line);
	   if (!ip) { logger.error(line); return; }
	   logger.log('receive',ipcache);
	   if (ip[3]) {
		   var alias = this[ip[3]].split(':');
		   ipcache.srcIp = alias[0] || '127.0.0.1';
		   ipcache.srcPort = alias[1] || 5060;
	   }
	   ipcache.dstIp = ip[2].split(':')[0];
	   ipcache.dstPort = ip[2].split(':')[1];
	   ipcache.ts =  parseInt(new Date(ip[1].trim()).getTime()/1000);
	   ipcache.usec = parseInt(ip[1].split('.')[1])
	   last = ip[5];
   	   last += line + '\n\n';
	   var callid = \Call-ID: (.*)\\n\.exec(last);
	   ipcache.callId = callid;
	   logger.info('outbound',ipcache);
	   this.postProcess(ipcache,last);
   }
};

exports.create = function() {
  return new FilterAppAudiocodes();
};
