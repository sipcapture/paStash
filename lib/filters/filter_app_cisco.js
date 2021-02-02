/* 
   Custom, Unoptimized Cisco ISR Log to SIP/HEP3 Parser w/ reassembly of rows 
   (C) 2020 Pierok13
*/

var base_filter = require('../lib/base_filter'),
 util = require('util'),
 logger = require('log4node'),
 dns = require('dns'),
 moment = require('moment');

function FilterAppCisco() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppCisco',
    start_hook: this.start,
  });
}

util.inherits(FilterAppCisco, base_filter.BaseFilter);

FilterAppCisco.prototype.start = function(callback) {
  logger.info('Initialized App Cisco ISR Log to SIP/HEP parser');
  this.postProcess = function(){
	 if(!last||!ipcache) return;
		
		ip_regex=/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
		if (!(ip_regex.exec(ipcache.srcIp))){
			dns.lookup(ipcache.srcIp,(error, addresses) => { 
				console.error(error); 
				console.error(addresses);
				 if (addresses){
					ipcache.srcIp=addresses[1]; 
				 }
			});
		}
		if (!(ip_regex.exec(ipcache.dstIp))){
			dns.lookup(ipcache.dstIp,(error, addresses) => { 
				console.error(error); 
				console.error(addresses);
				 if (addresses){
					ipcache.dstIp=addresses[1];
				 }
				});
		}
	

	 var rcinfo = {
		type: 'HEP',
		version: 3,
		payload_type: 1,
		ip_family: 2,
		protocol: 1,
		proto_type: 1,
		correlation_id: ipcache.callId || '',
		srcIp: ipcache.srcIp,
		srcPort: ipcache.srcPort||5060,
		dstIp: ipcache.dstIp,
		dstPort: ipcache.dstPort||5060,
		time_sec: ipcache.ts || '',
		time_usec: ipcache.usec || ''
	};
	if (last && rcinfo) {
		var data = { payload: last, rcinfo: rcinfo };
		this.emit('output', data);
		last = '';
		direction='';
	}
  }
  callback();
};

var last = '';
var ipcache = {};
var direction='';
var ip_to='';
var ip_from='';
var callId='';
var xcid='';

FilterAppCisco.prototype.process = function(data) {

	var line = data.message;
	var	device = data.host;

	//console.log("line received from host : "+ device + " line : "+line);
	payload_regex=/<\d*>.*?(:\s|:)(\*|)/g;
	line_clean=line.replace(payload_regex,'');
	//console.log("line cleaned : "+line_clean);
	
	callid_regex=/Call-ID:\s(.*?)$/m;
	callId=callid_regex.exec(line_clean);
	if (callId&&callId[1]) {
		ipcache.callId=callId[1];
		//console.log("callId : "+callId[1]);
	}
	
	xcid_regex=/x-cid:\s(.*?)$/m;
	xcid=xcid_regex.exec(line_clean);	
	if (xcid&&xcid[1]) {
		ipcache.callId=xcid[1];
		//console.log("xcid : "+xcid[1]);
	}
	
	direction_regex=/(Sent|Received):/;
	direction=direction_regex.exec(line_clean);
	
	from_regex=/From:\s(?:\".*?\"\s|)<sip:(?:.*?@|)(.*?)>\;/;
	to_regex=/To: <sip:(?:.*?@|)(.*?)>/;
	ip_to=to_regex.exec(line_clean);
	ip_from=from_regex.exec(line_clean);
    
	
	if (direction&&direction[1]) {
		switch (direction[1]) {
			case 'Sent':
					ipcache.srcIp = device;
					if (ip_from){
						if (ip_from[1]!=device)
						{
							ipcache.dstIp = ip_from[1];
						}
						else
						{
							ipcache.dstIp = ip_to[1];
						}
					}
			break;
			case 'Received':
					ipcache.dstIp = device;
					if (ip_from){
						if (ip_from[1]!=device)
						{
							ipcache.srcIp = ip_from[1];
						}
						else
						{
							ipcache.srcIp = ip_to[1];
						}
					}
			break;
		}
	}
	
	date_regex = /([A-Za-z]{3}\s{1,2}\d{1,2}\s\d{2}:\d{2}:\d{2}\.\d+)/;
	
	date=date_regex.exec(line_clean);
	
	if (date) {
		ipcache.xdate = moment(date[1], 'MMM DD HH:mm:ss.SSS');
		ipcache.ts = ipcache.xdate.unix();
		ipcache.usec = ipcache.xdate.millisecond() * 1000;
	}
	payloadfinal_regex=/^[A-Za-z]{3}\s{1,2}\d{1,2}\s\d{2}:\d{2}:\d{2}\.\d+.*?:\s.*SIP\/Msg\/ccsipDisplayMsg:\n(Sent|Received):\n/g;
	last=line_clean.replace(payloadfinal_regex,'') +"\r\n";
	this.postProcess();
	
};

exports.create = function() {
  return new FilterAppCisco();
};
