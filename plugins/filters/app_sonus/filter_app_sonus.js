/*
   Custom, Unoptimized Sonus Log to SIP/HEP3 Parser w/ reassembly of rows
   (C) 2020 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var moment = require('moment');

function FilterAppSonus() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppSonus',
    optional_params: ['correlation_hdr'],
    default_values: {
      'correlation_hdr': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppSonus, base_filter.BaseFilter);

FilterAppSonus.prototype.start = function(callback) {
logger.info('Initialized App Sonus Log to SIP/HEP parser');
  this.postProcess = function(){
	 if(!last||!ipcache) return;
         var rcinfo = {
              type: 'HEP',
              version: 3,
              payload_type: 1,
              ip_family: 2,
              protocol: 6,
              proto_type: 1,
              correlation_id: ipcache.callId || '',
              srcIp: ipcache.srcIp,
              srcPort: ipcache.srcPort,
              dstIp: ipcache.dstIp,
              dstPort: ipcache.dstPort,
              time_sec: ipcache.ts || '',
              time_usec: ipcache.usec || ''
            };

	 // EXTRACT CORRELATION HEADER, IF ANY
	 /*
	 if (this.correlation_hdr) {
		var xcid = sip.match(this.correlation_hdr+":\s?(.*)\\r");
		if (xcid && xcid[1]) rcinfo.correlation_id = xcid[1].trim();
	 }
	 */

         if (last && rcinfo) {
           var data = { payload: last, rcinfo: rcinfo };
	   this.emit('output', data);
	   last = '';
	   ipcache = {};
	   hold = false;
         }
  }
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
	if (!ip) { console.error(line);  return; }
	if (hold) this.postProcess();
	ipcache.srcIp = ip[1];
	ipcache.srcPort = ip[2];
	ipcache.dstIp = ip[3];
	ipcache.dstPort = ip[4];
	date_regex = /^\[(.*)\]\s/g;
        ipcache.xdate = moment(date_regex.exec(line)[1].split(',').join('.'), 'DD-MM-YYYY HH:mm:ss.SSS');
	ipcache.ts = ipcache.xdate.unix();
        ipcache.usec = ipcache.xdate.millisecond() * 1000;
	//console.log('out',ipcache);

   } else if (line.indexOf('Incoming message on') !== -1) {
        var regex = /Incoming message on \[(.*)\]:(.*) from \[(.*)\]:([^\s]+)/g;
        var ip = regex.exec(line);
	if (!ip) { console.error(line);  return; }
	if (hold) this.postProcess();
	ipcache.srcIp = ip[3];
	ipcache.srcPort = ip[4];
	ipcache.dstIp = ip[1];
	ipcache.dstPort = ip[2];
	date_regex = /^\[(.*)\]\s/g;
        ipcache.xdate = moment(date_regex.exec(line)[1].split(',').join('.'), 'DD-MM-YYYY HH:mm:ss.SSS');
	ipcache.ts = ipcache.xdate.unix();
        ipcache.usec = ipcache.xdate.millisecond() * 1000;
	//console.log('in',ipcache);

   } else if (line.indexOf('received msg for CallId') !== -1) {
	if (hold) this.postProcess();
	   var regex = /\d+\s(.*)\s(.*):\d.*\: received msg for CallId:(.*) from IP\/port:(.*)\/(.*), Local IP\/port:(.*)\/(.*), SMM:(.*)/g;
	   var ip = regex.exec(line);
	   if (!ip) { console.error(line);  return; }
	   ipcache.srcIp = ip[4];
	   ipcache.srcPort = ip[5];
	   ipcache.dstIp = ip[6];
	   ipcache.dstPort = ip[7];
	   ipcache.callId = ip[3];
	   ipcache.group = ip[8];
	   ipcache.ts = convertDate(ip[1],ip[2]);
	   ipcache.usec = ip[2].split('.')[1];
	   //console.log('in',ipcache);

   } else if (line.indexOf('sent msg for CallId') !== -1) {
	if (hold) this.postProcess();
	   var regex = /\d+\s(.*)\s(.*):\d.*\: sent msg for CallId:(.*) to IP\/port:(.*)\/(.*), Local IP\/port:(.*)\/(.*), SMM:(.*)/g;
	   var ip = regex.exec(line);
	   if (!ip) { console.error(line); return; }
	   ipcache.srcIp = ip[6];
	   ipcache.srcPort = ip[7];
	   ipcache.dstIp = ip[4];
	   ipcache.dstPort = ip[5];
	   ipcache.callId = ip[3];
	   ipcache.group = ip[8];
	   ipcache.ts = convertDate(ip[1],ip[2]);
	   ipcache.usec = ip[2].split('.')[1];
	   //console.log('out',ipcache);

   } else if (line.startsWith("Sonus Networks") ) {

   } else if (line.startsWith("RAW PDU") || line.startsWith("[") ) {
	        hold = true;

   } else {

      // Parse Payload
      if ( hold ) {

      	if (line.length > 1) {
		last += line + '\n';
		return;
      	} else {
		this.postProcess();
      	}

      }
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
  return new FilterAppSonus();
};
