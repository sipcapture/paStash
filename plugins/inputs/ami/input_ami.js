/*

Asterisk AMI Input Handler
(c) 2017 Lorenzo Mangani, QXIP BV

*/

var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

// Require & Setup modules
var aio = require('asterisk.io'),
    ami = null;

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
  this.port = this.parsed_url.params.port ? this.parsed_url.params.port : 5038;
  this.host = this.parsed_url.params.host ? this.parsed_url.params.host : '127.0.0.1';
  this.pass = this.parsed_url.params.pass ? this.parsed_url.params.pass : 'admin';
  this.user = this.parsed_url.params.wait ? this.parsed_url.params.wait : 'admin';

  logger.info('Connecting AMI socket to '+this.host+':'+this.port);

  this.socket = aio.ami(this.host, this.port, this.user, this.pass)
  .on("error", function (error) {
      logger.info('AMI Connection Error ' + JSON.stringify(error));
      this.emit('error', error);
  }).on("eventAny", function(e) {
      // AMI event processing: https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AMI+Events
      	this.emit('data', e);
  }.bind(this));
  callback();

};

InputAMI.prototype.close = function(callback) {
  logger.info('Closing AMI socket');
  try { this.socket.close(); } catch(err){ console.log('failed killing socket...'); } 
  callback();
};

exports.create = function() {
  return new InputAMI();
};


