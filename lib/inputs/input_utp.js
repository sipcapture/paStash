var base_input = require('../lib/base_input'),
  utp = require('utp-native'),
  util = require('util'),
  logger = require('log4node');

function InputUtp() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Utp',
    host_field: 'host',
    port_field: 'port',
    optional_params: ['type'],
    start_hook: this.start,
  });
}

util.inherits(InputUtp, base_input.BaseInput);

InputUtp.prototype.start = function(callback) {
  logger.info('Start listening on utp', this.host + ':' + this.port);

  this.server = utp();

  this.server.on('message', function(data, remote) {
    this.unserialize_data(data, function(parsed) {
      this.emit('data', parsed);
    }.bind(this), function(data) {
      this.emit('data', {
        'message': data.toString().trim(),
        'host': remote.address,
        'utp_port': this.port,
        'type': this.type,
      });
    }.bind(this));
  }.bind(this));

  this.server.on('error', function(err) {
    this.emit('error', err);
  }.bind(this));

  this.server.bind(this.port, this.host, callback);
};

InputUtp.prototype.close = function(callback) {
  logger.info('Closing listening utp', this.host + ':' + this.port);
  this.server.close();
  callback();
};

exports.create = function() {
  return new InputUtp();
};
