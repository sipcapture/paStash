var base_input = require('@pastash/pastash').base_input,
  dgram = require('dgram'),
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var bencode = require('@qxip/bencode');

function InputBencodeUdp() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'BencodeUdp',
    host_field: 'host',
    port_field: 'port',
    optional_params: ['type'],
    start_hook: this.start,
  });
}

util.inherits(InputBencodeUdp, base_input.BaseInput);

InputBencodeUdp.prototype.start = function(callback) {
  logger.info('Start listening for BENCODE on udp', this.host + ':' + this.port);

  this.server = dgram.createSocket('udp4');

  this.server.on('message', function(data, remote) {
    this.unserialize_data(data, function(parsed) {
      this.emit('data', parsed);
    }.bind(this), function(data) {
      data = bencode.decode( Buffer.from(data.toString().trim() ), 'utf8' );
      this.emit('data', {
        'message': data.toString().trim(),
        'host': remote.address,
        'udp_port': this.port,
        'type': this.type,
      });
    }.bind(this));
  }.bind(this));

  this.server.on('error', function(err) {
    this.emit('error', err);
  }.bind(this));

  this.server.bind(this.port, this.host, callback);
};

InputBencodeUdp.prototype.close = function(callback) {
  logger.info('Closing listening BENCODE udp', this.host + ':' + this.port);
  this.server.close();
  callback();
};

exports.create = function() {
  return new InputBencodeUdp();
};
