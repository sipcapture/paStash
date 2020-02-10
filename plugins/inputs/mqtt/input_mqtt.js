var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  mqtt = require('mqtt'),
  logger = require('@pastash/pastash').logger;

function InputMQTT() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'MQTT',
    host_field: 'address',
    optional_params: ['topic'],
    start_hook: this.start,
  });
}

util.inherits(InputMQTT, base_input.BaseInput);

InputMQTT.prototype.start = function(callback) {
  logger.info('Connecting to MQTT Server', this.address);

  this.socket = mqtt.connect(this.address);

  this.socket.on('connect', function(data) {
	logger.info('Connected to MQTT Server', this.address);
	this.socket.subscribe(this.topic);
  });

  this.socket.on('message', function(data) {
    this.unserialize_data(data, function(parsed) {
      this.emit('data', parsed);
    }.bind(this), function(data) {
      var obj = {
        'message': data.toString().trim(),
        'mqtt_from': this.address
      };
      this.emit('data', obj);
    }.bind(this));
  }.bind(this));
};

InputMQTT.prototype.close = function(callback) {
  logger.info('Closing input MQTT', this.address);
  this.socket.close();
  callback();
};

exports.create = function() {
  return new InputMQTT();
};
