/* 
   Custom, Unoptimized RTPPROXY debug log parser extracting Correlation vectors
   (C) 2017 QXIP BV
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

function FilterAppRtpProxy() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppRtpProxy',
    optional_params: ['correlation_hdr'],
    default_values: {
      'correlation_hdr': 'Call-ID|Call-Id'
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppRtpProxy, base_filter.BaseFilter);

FilterAppRtpProxy.prototype.start = function(callback) {
  logger.info('Initialized App RTPProxy Log to SIP/HEP parser');
  callback();
};

var last;
var ipcache = [];

FilterAppRtpProxy.prototype.process = function(data) {

   if (!data.message) return data;
   var line = data.message;
   if (line.indexOf('received command ') !== -1) {
	var regex = /received command \"(.*)\s+([U,L])c(.*?)[\s](.*?)[\s]+/g;
        var ip = regex.exec(line);
	var token = ip[1];
	ipcache[token] = {};
	ipcache[token].media = [{}];
	ipcache[token].direction = (ip[2] == 'L') ? 1 : 0;
	ipcache[token].media[0].codec = ip[3].split(',')[0];
	ipcache[token].method = 'create';
	ipcache[token].correlation_id = ip[4];
	logger.debug('1: received',ipcache[token]);
   } else if (line.indexOf('sending reply ') !== -1) {
	var regex = /sending reply \"(.*)\s+(.*?)[\s](.*?)#012/g;
        var ip = regex.exec(line);
	var token = ip[1];
	if (!ipcache[token]) return;
	ipcache[token].media[0].port = ip[2];
	ipcache[token].media[0].ip = ip[3];
	ipcache[token].media[0].codec = ip[3];
	logger.debug('2: sent',ipcache[token]);
	// emit call correlation object
	data.message = ipcache[token];
	this.emit('output', data);
   } else if (line.indexOf('is cleaned up') !== -1) {
	var regex = /session on ports (.*)\/(.*?)[\s]is cleaned up/g;
        var ip = regex.exec(line);
	ip.forEach(function(port){
		logger.info('clearing up port '+port);
		Object.keys(ipcache).forEach(function(key){
			if (ipcache[key] && ipcache[key].media[0].port == port) {
					var clone = ipcache[key];
					clone.method = 'delete';
					this.emit('output', clone);

					logger.info('clearing session ',ipcache[key].correlation_id);
					delete ipcache[key]; // slow!
			}
		}.bind(this));
	}.bind(this));
   }
};

exports.create = function() {
  return new FilterAppRtpProxy();
};
