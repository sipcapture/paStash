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
  if(!this.topic||!this.address) return;
  logger.info('Connecting to MQTT Server', this.address);

  this.socket = mqtt.connect(this.address);

  this.socket.on('connect', function() {
        logger.info('Connected to MQTT Server', this.address);
        this.socket.subscribe(this.topic);
        callback();
  }.bind(this));

  this.socket.on('message', function(topic, data) {
    try {
      var obj = JSON.parse(data.toString());
      obj.topic = topic;
      this.emit('data', obj);
    } catch(e) {
      this.emit('data', data.toString());
    }
  }.bind(this));
};

InputMQTT.prototype.close = function(callback) {
  logger.info('Closing input MQTT', this.address);
  try { this.socket.end() } catch(e) {}
  callback();
};

exports.create = function() {
  return new InputMQTT();
};
