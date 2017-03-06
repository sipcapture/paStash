/*

FreeSwitch ESL Input Handler
(c) 2017 Lorenzo Mangani, QXIP BV

*/

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
    wait_field: 'wait',
    filter_field: 'filter',
    optional_params: ['uuid'],
    start_hook: this.start
  });
}

util.inherits(InputESL, base_input.BaseInput);

InputESL.prototype.start = function(callback) {
  if (!this.port) this.port = this.parsed_url.params.port ? this.parsed_url.params.port : 8021;
  if (!this.host) this.host = this.parsed_url.params.host ? this.parsed_url.params.host : '127.0.0.1';
  if (!this.pass) this.pass = this.parsed_url.params.pass ? this.parsed_url.params.pass : 'ClueCon';
  if (!this.wait) this.wait = this.parsed_url.params.wait ? this.parsed_url.params.wait : 60000;
  if (!this.filter) this.filter = this.parsed_url.params.filter ? this.parsed_url.params.filter : 'esl::event::**';

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
  }).on(this.filter, function(e,headers,body) {
      // ESL event processing
      	if (!e.getHeader('Event-Name')) {
  		logger.info('Unknown Event! Dropping packet... ');
		return;
	}
      	this.emit('data', e);
  }.bind(this));

  callback();

};

InputESL.prototype.close = function(callback) {
  logger.info('Closing ESL socket');
  try { this.socket.close(); } catch(err){ console.log('failed killing socket...'); }
  callback();
};

exports.create = function() {
  return new InputESL();
};


