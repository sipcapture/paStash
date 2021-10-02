/* 
   Custom, Unoptimized Genesys Log to SIP/HEP3 Parser w/ reassembly of rows 
   (C) 2017 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var moment = require('moment');
var QuickLRU = require('quick-lru');
const lru = new QuickLRU({maxSize: 5000});

function FilterAppGenesys() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppGenesys',
    optional_params: ['correlation_hdr'],
    default_values: {
      'correlation_hdr': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppGenesys, base_filter.BaseFilter);

FilterAppGenesys.prototype.start = function(callback) {
  logger.info('Initialized App Genesys Log to SIP/HEP parser');
  callback();
};

var regex_receive = /Received \[(.*),(.*)\] (.*) bytes from (.*):(.*) /
var regex_sending = /Sending  \[(.*),(.*)\] (.*) bytes to (.*):(.*) /


FilterAppGenesys.prototype.process = function(data) {

   var line = data.message;
   var payload_type = 1;

   if (line.indexOf('CID:CUUID>') !== -1) {
	var cid = line.split('>')[1].split(':')
        if (cid[0] && cid[1]) {
	  lru.set(cid[1],cid[0]);
	  lru.set(cid[0],cid[1]);
        }
        var payload = false;

   } else if (line.indexOf('SIPTR: Received') !== -1) {
      // SIP MESSAGE INBOUND
      var rcv = true;
      var payload = line.split`\n`.filter((l,i)=> i != 0).join`\n`.replace('\n', '\r\n');
      var head = line.substring(0, line.indexOf("\n"))
      var rc = regex_receive.exec(head);
      var callid = /Call-ID: (.*)\r/.exec(payload) || ['', 'false@127.0.0.1'];
      callid = callid[1]
      var UUID = lru.get(callid) || false;
      var localIp = callid.split('@')[1] || '127.0.0.1';
      var localPort = new RegExp("" + localIp + ":(.*)>", "gm").exec(payload) || [ 0, 5060];
      localPort = localPort[1];
      console.log('local rcv',callid, localIp, localPort);

   } else if (line.indexOf(': Sending  [') !== -1) {
      // SIP MESSAGE OUTBOUND
      var rcv = false;
      var payload = line.split`\n`.filter((l,i)=> i != 0).join`\n`.replace('\n', '\r\n');
      var head = line.substring(0, line.indexOf("\n"))
      var rc = regex_sending.exec(head);
      var callid = /Call-ID: (.*)\r/.exec(payload) || ['', 'false@127.0.0.1'];
      callid = callid[1]
      var UUID = lru.get(callid) || false;
      var localIp = callid.split('@')[1];
      var localPort = new RegExp("" + localIp + ":(.*)>", "gm").exec(payload) || [0, 5060];
      localPort = localPort[1];
      console.log('local sent',callid, localIp, localPort);

   } else if (line.indexOf('event: message') !== -1) {
      var UUID = /CallUUID\t'(.*)'\n/.exec(line);
      if(UUID && UUID[1]) {
        UUID = UUID[1];
	var rc = [0, 'UDP', 0, 0, '127.0.0.1', 0];
	var localIp = '127.0.0.1';
	var localPort = 0;
        console.log('got log!', UUID);
        var callid = lru.get(UUID);
        var payload = line;
        payload_type = 100;
        var payload = line;
      }
   }

   // HEP IP DATAGRAM
   if (payload && rc && rc[1]) {

         var rcinfo = {
              type: 'HEP',
              version: 3,
              payload_type: payload_type || 1,
              ip_family: 2,
              protocol: rc[1] == 'UDP' ? 17 : 6,
              proto_type: payload_type || 1,
              correlation_id: UUID || callid || '',
              srcIp: rcv ? rc[4] : localIp,
              srcPort: parseInt(rcv ? rc[5] : localPort),
              dstIp: rcv ? localIp : rc[4],
              dstPort: parseInt(rcv ? localPort : rc[5]),
              //time_sec: ts,
              //time_usec: ts_usec
         };

	 // EXTRACT CORRELATION HEADER, IF ANY
	 if (this.correlation_hdr) {
		var xcid = payload.match(this.correlation_hdr+":\s?(.*)\\r");
		if (xcid && xcid[1]) rcinfo.correlation_id = xcid[1].trim();
	 }

	 if (lru.has(callid)) {
		console.log('CACHED CORRELATION!', callid, lru.get(callid));
		rcinfo.correlation_id = lru.get(callid);
	 }

         if (payload && rcinfo) {
           var data = { payload: payload, rcinfo: rcinfo };
	   return data;
         }
   }

};

exports.create = function() {
  return new FilterAppGenesys();
};
