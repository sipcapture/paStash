var base_input = require('../lib/base_input'),
  util = require('util'),
  esl = require('modesl');
  logger = require('log4node');

function InputFreeswitch() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Freeswitch',
    host_field: 'host',
    port_field: 'port',
    pass_field: 'pass',
    optional_params: ['uuid'],
    start_hook: this.start,
  });
}

util.inherits(InputFreeswitch, base_input.BaseInput);

InputFreeswitch.prototype.start = function(callback) {
  logger.info('Connecting to Freeswitch ESL', this.host, ':', this.port);

  this.socket = new esl.Connection(this.host, this.port, this.pass);

  this.socket.on("error", function (error) {
      logger.info('ESL Connection Error ' + JSON.stringify(error));
      setTimeout(function() { socket(this.host, this.port, this.pass);}, 1000);
    }).on("esl::end", function () {
      logger.info('ESL Connection Ended');
      setTimeout(function() { socket(this.host, this.port, this.pass);}, 1000);
    }).on("esl::ready", function () {
      eslConn.events('json' , 'ALL', function() {
        logger.info('ESL ready - subscribed to receive events.');
      });
    }).on("esl::event::**", function (e, headers, body) {
       this.emit('data', e);
    });
};

InputFreeswitch.prototype.close = function(callback) {
  logger.info('Closing ESL connection', this.host);
  this.socket.close();
  callback();
};

exports.create = function() {
  return new InputFreeswitch();
};
