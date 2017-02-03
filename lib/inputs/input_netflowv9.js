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
  logger.info('Opening Netflowv9 socket on port '+this.port, this.port);

  this.socket = Collector;

  this.socket.on("error", function (error) {
      logger.info('Netflowv9 Connection Error ' + JSON.stringify(error));
      setTimeout(function() { socket(this.host, this.port, this.pass);}, 1000);
    }).on("template", function (e) {
       this.emit('template', e.flow[0]);
    }).on("data", function (e) {
       this.emit('data', e.flow[0]);
    });
};

InputNetflowv9.prototype.close = function(callback) {
  logger.info('Closing Netflowv9 socket', this.host);
  this.socket.close();
  callback();
};

exports.create = function() {
  return new InputNetflowv9();
};
