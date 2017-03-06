/*

Generic SIP Input Handler
(c) 2017 Lorenzo Mangani, QXIP BV

*/

var base_input = require('../lib/base_input'),
  util = require('util'),
  logger = require('log4node');

// Require & Setup modules
var sip = require('sip');


function InputSIP() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'SIP',
    port_field: 'port',
    host_field: 'host',
    optional_params: ['reply'],
    start_hook: this.start
  });
}

util.inherits(InputSIP, base_input.BaseInput);

InputSIP.prototype.start = function(callback) {
  this.port = this.parsed_url.params.port ? this.parsed_url.params.port : 5060;
  this.host = this.parsed_url.params.host ? this.parsed_url.params.host : '0.0.0.0';

  logger.info('Opening SIP socket at '+this.host+':'+this.port);

	sip.start({ port: this.port, address: this.address },
	function(rq) {
	  try {
	    if(rq.method) {  

			if (this.reply) {
				// Send Response
			      	var rs = sip.makeResponse(rq, 200, 'OK');
			      	rs.headers.contact = rq.headers.contact;
			      	sip.send(rs);
			}

			// Emit Object
			this.emit('event',rq);
		}
	    } else {
		  	logger.info('SIP Error! No Method, dropping message');
	    }

	}.bind(this));

  callback();

};

InputSIP.prototype.close = function(callback) {
  logger.info('Closing SIP socket');
  try { sip.stop(); } catch(err){ console.log('failed killing SIP socket...'); }; 
  callback();
};

exports.create = function() {
  return new InputSIP();
};
