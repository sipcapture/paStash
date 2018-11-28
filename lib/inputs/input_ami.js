/*

Asterisk AMI Input Handler
(c) 2017 Lorenzo Mangani, QXIP BV

*/

var base_input = require('../lib/base_input'),
  util = require('util'),
  logger = require('log4node');

/* IO Metrics */
var io = require('../lib/pmx_helper');
if (io) {
  var metrics = {
	ami_in_rps: io.meter({
	  name: 'in req/sec',
	  type: 'meter',
	}),
	ami_out_rps: io.meter({
	  name: 'out req/sec',
	  type: 'meter',
	}),
	ami_err_rps: io.meter({
	  name: 'err req/sec',
	  type: 'meter',
	})
  };
}

// Require & Setup modules
const AmiClient = require('asterisk-ami-client');

function InputAMI() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'AMI',
    port_field: 'port',
    host_field: 'host',
    pass_field: 'pass',
    user_field: 'user',
    optional_params: ['uuid'],
    start_hook: this.start
  });
}

util.inherits(InputAMI, base_input.BaseInput);

InputAMI.prototype.start = function(callback) {

  this.client = new AmiClient();

  this.port = this.parsed_url.params.port ? this.parsed_url.params.port : 5038;
  this.host = this.parsed_url.params.host ? this.parsed_url.params.host : '127.0.0.1';
  this.pass = this.parsed_url.params.pass ? this.parsed_url.params.pass : 'admin';
  this.user = this.parsed_url.params.wait ? this.parsed_url.params.wait : 'admin';

  logger.info('Connecting AMI socket to '+this.host+':'+this.port);
  this.client.connect(this.user, this.pass, {host: this.host, port: this.port})
   .then(amiConnection => {
     client
	.on('event', event => { this.emit('data',event); metrics.ami_in_rps.mark(); metrics.ami_out_rps.mark(); } )
	.on('internalError', event => { this.emit('error',event); metrics.ami_err_rps.mark(); } )
  }.bind(this));
  callback();

};

InputAMI.prototype.close = function(callback) {
  logger.info('Closing AMI socket');
  try {  this.client.disconnect(); } catch(err){ console.log('failed killing socket...'); }
  callback();
};

exports.create = function() {
  return new InputAMI();
};


