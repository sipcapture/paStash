/*
   Custom, Unoptimized Sonus Log to SIP/HEP3 Parser w/ reassembly of rows
   (C) 2024 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var moment = require('moment');

function FilterAppSonusMonitor() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppSonusMonitor',
    optional_params: ['correlation_hdr','type'],
    default_values: {
      'correlation_hdr': false,
      'remove_headers': false,
      'debug': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppSonusMonitor, base_filter.BaseFilter);

FilterAppSonusMonitor.prototype.start = function(callback) {
  logger.info('Initialized App Sonus Monitoring to HEP parser');
  callback();
};

FilterAppSonusMonitor.prototype.process = function(data) {
	if(!data.payload) return;

	try {
	  // PARSE HEADERS
          const srcRegex = [...data.payload.matchAll(/srcIp: ([0-9.]+):([0-9]+)/g)];
          const dstRegex = [...data.payload.matchAll(/dstIp: ([0-9.]+):([0-9]+)/g)];
          const tsRegex = [...data.payload.matchAll(/Timestamp=([0-9.]+).([0-9]+)/g)];

	  // REMOVE HEADERS
	  if (this.remove_headers) {
		data.payload = str.replace(/(srcIp.*?)(?:\r|\n|\r\n){2}/, "")
		data.payload = str.replace(/(dstIp.*?)(?:\r|\n|\r\n){2}/, "")
	  }
	} catch(e) { console.log('failed parsing', e) }

	// HEP MAKER
        data.rcinfo = {
              type: 'HEP',
              version: 3,
              payload_type: 1,
              ip_family: 2,
              protocol: 17,
              proto_type: 1,
              srcIp: srcRegex[1] || '127.0.0.1',
              srcPort: srcRegex[2] || 5061,
              dstIp: dstRegex[1] || '127.0.0.2',
              dstPort: dstRegex[2] || 5061,
              time_sec: tsRegex[1] || new Date().getTime(),
              time_usec: tsRegex[2] || 000
            };

	 // EXTRACT CORRELATION HEADER, IF ANY
	 if (this.correlation_hdr) {
		var xcid = data.payload.match(this.correlation_hdr+":\s?(.*)\\r");
		if (xcid && xcid[1]) data.rcinfo.correlation_id = xcid[1].trim();
	 }

	 if (last.indexOf('2.0/TCP') !== -1 || last.indexOf('2.0/TLS') !== -1){
		rcinfo.protocol = 6;
         }

	 this.emit('output', data);

};

exports.create = function() {
  return new FilterAppSonusMonitor();
};
