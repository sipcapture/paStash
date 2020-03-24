/*
   Custom, Unoptimized Sonus Log to SIP/HEP3 Parser w/ reassembly of rows
   (C) 2020 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var moment = require('moment');

function FilterAppSonusLog() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppSonusLog',
    optional_params: ['correlation_hdr'],
    default_values: {
      'correlation_hdr': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppSonusLog, base_filter.BaseFilter);

FilterAppSonusLog.prototype.start = function(callback) {
logger.info('Initialized App Sonus SysLog to SIP/HEP parser');
  this.postProcess = function(){
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

	 if (last.indexOf('2.0/TCP') !== -1){
		rcinfo.protocol = 6;
         }

         if (last && rcinfo) {
           var data = { payload: last, rcinfo: rcinfo };
	   this.emit('output', data);
	   last = '';
	   ipcache = {};
         }
  }
  callback();
};

var last = '';
var ipcache = {};

FilterAppSonusLog.prototype.process = function(data) {

   var line = data.message;

   if (line.indexOf('sent msg for CallId') !== -1) {
	   var regex = /<147> [0-9] (.*)usec(.*?)sent msg for CallId:(.*) to IP\/port:(.*)\/(.*), Local IP\/port:(.*)\/(.*), SMM:(.*)RAW PDU:#012(.*)/g;
	   var ip = regex.exec(line);
	   if (!ip) { logger.error(line); return; }
	   ipcache = {};
	   ipcache.srcIp = ip[6];
	   ipcache.srcPort = ip[7];
	   ipcache.dstIp = ip[4];
	   ipcache.dstPort = ip[5];
	   ipcache.callId = ip[3];
	   ipcache.group = ip[8];
	   ipcache.ts =  parseInt(new Date(ip[1].trim()).getTime()/1000);
	   ipcache.usec = parseInt(ip[1].split('.')[1])
	   last = ip[9];
           last = last.replace(/#015#012/g, '\r\n');
           last = last.replace(/#012/g, '\n');
	   logger.info('out',ipcache);
	   this.postProcess();

   } else if (line.indexOf('received msg for CallId') !== -1) {
	   var regex = /<147> [0-9] (.*)usec(.*?)received msg for CallId:(.*) from IP\/port:(.*)\/(.*), Local IP\/port:(.*)\/(.*), SMM:(.*)RAW PDU:#012(.*)/g;
	   var ip = regex.exec(line);
	   if (!ip) { logger.error(line); return; }
	   logger.log('receive',ipcache);
	   ipcache.srcIp = ip[6];
	   ipcache.srcPort = ip[7];
	   ipcache.dstIp = ip[4];
	   ipcache.dstPort = ip[5];
	   ipcache.callId = ip[3];
	   ipcache.group = ip[8];
	   ipcache.ts =  parseInt(new Date(ip[1].trim()).getTime()/1000);
	   ipcache.usec = parseInt(ip[1].split('.')[1])
	   last = ip[9];
           last = last.replace(/#015#012/g, '\r\n');
           last = last.replace(/#012/g, '\n');
   	   last += line + '\r\n';
	   logger.info('out',ipcache);
	   this.postProcess();
   }
};

var convertDate = function(date,time){
	var regex = /([0-9]{2})([0-9]{2})([0-9]{4})/g;
	var dd = regex.exec(date)
	var regex = /([0-9]{2})([0-9]{2})([0-9]{2}).(.*)/g;
	var tt = regex.exec(time)
	var newdate = dd[3]+"-"+dd[1]+"-"+dd[2]+"T"+tt[1]+":"+tt[2]+":"+tt[3]+"."+tt[4]+"Z";
	var output = Date.parse(newdate);
	if (output) return output;
	else return new Date().getTime();
}

exports.create = function() {
  return new FilterAppSonusLog();
};
