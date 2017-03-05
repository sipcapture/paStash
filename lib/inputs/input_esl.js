var base_input = require('../lib/base_input'),
  util = require('util'),
  logger = require('log4node');

// Require & Setup modules
var esl = require('modesl');

function InputESL() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'ESL',
    port_field: 'port',
    host_field: 'host',
    pass_field: 'pass',
    pass_wait: 'wait',
    optional_params: ['uuid'],
    start_hook: this.start,
  });
}

util.inherits(InputESL, base_input.BaseInput);

InputESL.prototype.start = function(callback) {
  this.port = this.parsed_url.params.port ? this.parsed_url.params.port : 8021;
  this.host = this.parsed_url.params.host ? this.parsed_url.params.host : '127.0.0.1';
  this.pass = this.parsed_url.params.pass ? this.parsed_url.params.pass : 'ClueCon';
  this.wait = this.parsed_url.params.wait ? this.parsed_url.params.wait : 60000;

  logger.info('Connecting ESL socket to '+this.host+':'+this.port);

  this.socket = new esl.Connection(this.host, this.port, this.pass)
  .on("error", function (error) {
      logger.info('ESL Connection Error ' + JSON.stringify(error));
      this.emit('error', error);
  }).on("esl::end", function (e) {
	logger.info('ESL Connection Ended from remote! Retrying in '+this.wait); 
        setTimeout(function() { this.start(callback);}, this.wait);
  }).on("esl::ready", function (e) {
	logger.info('ESL Connected!');
  }).on("esl::event::**", function(e,headers,body) {
      // ESL event processing
      	console.log('Event: ' + e.getHeader('Event-Name'));
      	console.log('Unique-ID: ' + e.getHeader('Unique-ID'));
      	this.emit('event', e);
  }.bind(this));

  callback();

};

InputESL.prototype.close = function(callback) {
  logger.info('Closing ESL socket');
  try { this.socket.close(); } catch(err){ console.log('failed killing socket...'); }; 
  callback();
};

exports.create = function() {
  return new InputESL();
};


