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
    optional_params: ['correlation_hdr','bypass', 'debug', 'logs', 'localip', 'localport'],
    default_values: {
      'correlation_hdr': false,
      'debug': true,
      'bypass': false,
      'logs': false,
      'localip': '127.0.0.1',
      'localport': 5060
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppAudiocodes, base_filter.BaseFilter);

FilterAppAudiocodes.prototype.start = function(callback) {
logger.info('Initialized App Audiocodes SysLog to SIP/HEP parser');
  this.postProcess = function(ipcache,last,type){
	 if(!last||!ipcache) return;
   	 last = last.replace(/#012/g, '\r\n').trim() + "\r\n\r\n";
         var rcinfo = {
              type: 'HEP',
              version: 3,
              payload_type: type ? 'LOG' : 'SIP',
              ip_family: 2,
              protocol: 17,
              proto_type: type || 1,
              correlation_id: ipcache.callId || '',
              srcIp: ipcache.srcIp,
              srcPort: ipcache.srcPort,
              dstIp: ipcache.dstIp,
              dstPort: ipcache.dstPort,
              time_sec: ipcache.ts || parseInt(new Date().getTime() / 1000),
              time_usec: ipcache.usec || new Date().getMilliseconds()
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
           var data = { payload: last, rcinfo: rcinfo };
	   return data;
         }
  }
  callback();
};

var last = '';
var ipcache = {};
var alias = {};

var hold;
var cache;

FilterAppAudiocodes.prototype.process = function(data) {

   var line = data.message.toString();
   var ipcache = {};

   if(hold) {
	var message = /^.*?\[S=[0-9]+\].*?\[SID=.*?\]\s?(.*)\[Time:.*\]$/
	var test = message.exec(line.replace(/\n/g, '#012'));
	if (this.debug) console.log('cache is',cache);
	if (this.debug) console.log('line is',test[1]);
	line = cache + test[1];
	hold = false;
	cache = '';
	if (this.debug) console.info('reassembled line', line);
   }

   line = line.replace(/\n/g, '#012');

   var ids = /\[SID=(?<mac>.*?):(?<seq>.*?):(?<sid>.*?)\]/.exec(line) || [];
   if (this.debug) logger.error('SESSION SID',ids[3]);

   if (line.indexOf('Incoming SIP Message') !== -1) {
      try {
	   // var regex = /(.*)---- Incoming SIP Message from (.*) to SIPInterface #[0-99] \((.*)\) (.*) TO.*--- #012(.*)#012 #012 #012(.*) \[Time:(.*)-(.*)@(.*)\]/g;
	   var regex = /(.*)---- Incoming SIP Message from (.*) to SIPInterface #[0-99] \((.*)\) (.*) TO.*--- #012(.*)#012 #012(.*)/g;
	   var ip = regex.exec(line);
	   if (!ip) {
		logger.error('failed parsing Incoming SIP. Cache on!');
		cache = /(.*)\[Time:.*\]/.exec(line)[1] || '';
		hold = true;
		if (this.bypass) return data;
	   } else {
		   if (ip[3]) {
			/* convert alias to IP:port */
			   // var alias = this[ip[3]].split(':');
			   ipcache.dstIp = alias[0] || this.localip;
			   ipcache.dstPort = alias[1] || this.localport;
		   }
		   ipcache.srcIp = ip[2].split(':')[0];
		   ipcache.srcPort = ip[2].split(':')[1];
		   last = ip[5];
	   	   last += '#012 #012';
		   var callid = last.match(/call-id:\s?(.*?)\s?#012/i) || [];
		   ipcache.callId = ids[3] || callid[1] || '';
		   return this.postProcess(ipcache,last);
	   }
     } catch(e) { logger.error(e); }

   } else if (line.indexOf('Outgoing SIP Message') !== -1) {
      try {
	   // var regex = /(.*)---- Outgoing SIP Message to (.*) from SIPInterface #[0-99] \((.*)\) (.*) TO.*--- #012(.*)#012 #012 #012(.*) \[Time:(.*)-(.*)@(.*)\]/g;
	   var regex = /(.*)---- Outgoing SIP Message to (.*) from SIPInterface #[0-99] \((.*)\) (.*) TO.*--- #012(.*)#012 #012 (.*)/g;
	   var ip = regex.exec(line);
	   if (!ip) {
		logger.error('failed parsing Outgoing SIP. Cache on!');
		cache = /(.*)\[Time:.*\]/.exec(line)[1] || '';
		hold = true;
		if (this.bypass) return data;
	   } else {
		   if (ip[3]) {
			   // var alias = this[ip[3]].split(':');
			   ipcache.srcIp = alias[0] || this.localip;
			   ipcache.srcPort = alias[1] || this.localport;
		   }
		   ipcache.dstIp = ip[2].split(':')[0];
		   ipcache.dstPort = ip[2].split(':')[1];
		   last = ip[5];
	   	   last += '#012 #012';
		   var callid = last.match(/call-id:\s?(.*?)\s?#012/i) || [];
		   ipcache.callId = ids[3] || callid[1] || '';
		   return this.postProcess(ipcache,last);
	   }
     } catch(e) { logger.error(e); }

   } else if (ids[3] && !hold) {
	if (this.bypass) return data;
	// Prepare SIP LOG
	ipcache.callId = ids[3] || '';
	ipcache.srcIp = '127.0.0.1';
	ipcache.srcPort = 0
	ipcache.dstIp = '127.0.0.1';
	ipcache.dstPort = 0
	if (this.logs) return this.postProcess(ipcache,line,100);
   } else {
	// Discard
	if (this.bypass) return data;
   }
};

exports.create = function() {
  return new FilterAppAudiocodes();
};
