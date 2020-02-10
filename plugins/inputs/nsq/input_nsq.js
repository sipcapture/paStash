var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var nsq = require('nsqjs');

function InputNsq() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'NSQ',
    host_field: 'host',
    port_field: 'port',
    required_params: ['channel', 'topic'],
    optional_params: ['durable', 'debug'],
    default_values: {
      'durable': true,
      'debug': false
    },
    start_hook: this.start,
  });
}

util.inherits(InputNsq, base_input.BaseInput);

InputNsq.prototype.start = function(callback) {

  logger.info('Start NSQ listener', 'channel:' + this.channel, 'topic:' + this.topic);

	var emit = this.emit;
	const reader = new nsq.Reader(this.topic, this.channel, {
	  lookupdHTTPAddresses: this.host+':'+this.port
	});
	reader.connect();
	reader.on('message', msg => {
	    logger.debug('Received message [%s]: %s', msg.id, msg.body.toString());
	    msg.finish();
	    this.emit('data', msg);
	});

  callback();
};

InputNsq.prototype.close = function(callback) {
  logger.info('Closing NSQ input', 'topic: ' + this.topic, 'channel: ' + this.channel);
  callback();
};

exports.create = function() {
  return new InputNsq();
};
