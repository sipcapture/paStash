var base_output = require('@pastash/pastash').base_output,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var mqtt = require('mqtt');

function OutputMqtt() {
  base_output.BaseOutput.call(this);
  this.mergeConfig({
    name: 'OutputMQTT',
    optional_params: ['topic', 'address','subscribe'],
    default_values: {
      'topic': false,
      'subscribe': false,
      'address': false
    },
    start_hook: this.start
  });
}

util.inherits(OutputMqtt, base_output.BaseOutput);

OutputMqtt.prototype.start = function(callback) {

  if(!this.topic||!this.address) return;

  logger.info('Connecting to MQTT Server', this.address);

  this.socket = mqtt.connect(this.address);

  this.socket.on('connect', function(data) {
	logger.info('Connected to MQTT Server', this.socket);
	if (this.subscribe) this.socket.subscribe(this.topic);
        callback();
  }.bind(this));

};

OutputMqtt.prototype.process = function(data) {
  this.socket.publish(this.topic,JSON.stringify(data));
};

OutputMqtt.prototype.close = function(callback) {
  logger.info('Closing MQTT output to', this.address);
  this.socket.end();
  callback();
};

exports.create = function() {
  return new OutputMqtt();
};
