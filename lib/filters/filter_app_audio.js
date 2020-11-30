/* 
   Custom, Unoptimized Audiocodes Log to SIP/HEP3 Parser w/ reassembly of rows 
   (C) 2020 Pierok13
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var moment = require('moment');

function FilterAppAudio() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppAudio',
    optional_params: ['correlation_hdr'],
    required_params: ['sbc_wan_name','sbc_lan_name','sbc_wan_ip','sbc_wan_port','sbc_lan_ip','sbc_lan_port'],
	default_values: {
      'correlation_hdr': 'Call-ID|Call-Id',
	  'sbc_wan_name':'WAN_SIP',
	  'sbc_lan_name':'LAN_SIP'
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppAudio, base_filter.BaseFilter);

FilterAppAudio.prototype.start = function(callback) {
  logger.info('Initialized App Audiocodes Log to SIP/HEP parser');
  this.postProcess = function(){
	 if(!last||!ipcache) return;
         var rcinfo = {
              type: 'HEP',
              version: 3,
              payload_type: 1,
              ip_family: 2,
              protocol: 1,
              proto_type: 1,
              correlation_id: ipcache.callId || '',
              srcIp: ipcache.srcIp,
              srcPort: ipcache.srcPort,
              dstIp: ipcache.dstIp,
              dstPort: ipcache.dstPort,
              time_sec: ipcache.ts || '',
              time_usec: ipcache.usec || ''
            };

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

FilterAppAudio.prototype.process = function(data) {

   var line = data.message;
  
   if (line.indexOf('---- Outgoing SIP Message to') !== -1) {
        var regex = /---- Outgoing SIP Message to (.*?):(.*?) from SIPInterface .* \((.*?)\)/;
		var ip = regex.exec(line);
		if (!ip) { console.error(line);  return; }
		if (hold) this.postProcess();
		ipcache.dstIp = ip[1];
		ipcache.dstPort = ip[2];
		switch (ip[3]) {
			case sbc_wan_name:
				ipcache.srcIp = sbc_wan_ip;
				ipcache.srcPort = sbc_wan_port;
			break;
			case sbc_wan_name:
				ipcache.srcIp = sbc_lan_ip;
				ipcache.srcPort = sbc_lan_port;
			break;
		}
		
		date_regex = /\[Time:(.*)\]$/;
		ipcache.xdate = moment(date_regex.exec(line)[1].split('@').join('.'), 'DD-MM HH:mm:ss.SSS');
		ipcache.ts = ipcache.xdate.unix();
		ipcache.usec = ipcache.xdate.millisecond() * 1000;
		hold = true;
	   } else if (line.indexOf('---- Incoming SIP Message from') !== -1) {
			var regex = /---- Incoming SIP Message from (.*?):(.*?) to SIPInterface .* \((.*?)\)/;
			var ip = regex.exec(line);
		if (!ip) { console.error(line);  return; }
		if (hold) this.postProcess();
		ipcache.srcIp = ip[1];
		ipcache.srcPort = ip[2];
		switch (ip[3]) {
			case sbc_wan_name:
				ipcache.srcIp = sbc_wan_ip;
				ipcache.srcPort = sbc_wan_port;
			break;
			case sbc_wan_name:
				ipcache.srcIp = sbc_lan_ip;
				ipcache.srcPort = sbc_lan_port;
			break;
		}
		date_regex = /\[Time:(.*)\]$/;
		ipcache.xdate = moment(date_regex.exec(line)[1].split('@').join('.'), 'DD-MM HH:mm:ss.SSS');
		ipcache.ts = ipcache.xdate.unix();
		ipcache.usec = ipcache.xdate.millisecond() * 1000;
		hold = true;
   
   } else {

      // Parse Payload
      if ( hold ) {
        payload_regex=/^.*?\[S=[0-9]+\].*?\[SID=.*?\]\s*/;
		line_clean=line.replace(payload_regex,'').replace(date_regex,'');
      	 // EXTRACT CORRELATION HEADER, IF ANY
		if (this.correlation_hdr) {
			var xcid = line_clean.match(this.correlation_hdr+":\s?(.*)\\n");
				if (xcid && xcid[1]) ipcache.callId = xcid[1].trim();
		}
		last = line_clean + '\r\n';
		this.postProcess();
    	

      }
   }
};

exports.create = function() {
  return new FilterAppAudio();
};
