var base_input = require('../lib/base_input'),
  util = require('util'),
  logger = require('log4node');
  
var Collector = require('node-netflowv9');

function InputNetflowv9() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Netflowv9',
    port_field: 'port',
    optional_params: ['uuid'],
    start_hook: this.start,
  });
}

util.inherits(InputNetflowv9, base_input.BaseInput);

InputNetflowv9.prototype.start = function(callback) {
  this.port = this.parsed_url.params.port;
  this.host = this.parsed_url.params.host;
  logger.info('Opening Netflowv9 socket on port '+this.port);

  this.socket = Collector({port: this.port});

  this.socket.on("error", function (error) {
      logger.info('Netflowv9 Connection Error ' + JSON.stringify(error));
      this.emit('error', error);
  }).on("template", function (e) {
	if(!e) return;
	// console.log('TEMPLATE: ',e);
       	this.emit('template', e.templates[0]);
  }).on('data', function(data) {
      if (!data.flows) return;
	// console.log('got data..');
        this.emit('data', data);
  }.bind(this));

  callback();

};

InputNetflowv9.prototype.close = function(callback) {
  logger.info('Closing Netflowv9 socket');
  try { this.socket().close(); } catch(err){ console.log('failed killing socket...'); }; 
  callback();
};

exports.create = function() {
  return new InputNetflowv9();
};
