var base_input = require('../lib/base_input'),
  util = require('util'),
  logger = require('log4node');

var nsq = require('nsqjs');

function InputNsq() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig(ssl_helper.config());
  this.mergeConfig({
    name: 'NSQ',
    host_field: 'host',
    port_field: 'port',
    required_params: ['channel', 'topic'],
    optional_params: ['durable', 'debug'],
    default_values: {
      'durable': true,
      'debug': false,
    },
    start_hook: this.start,
  });
}

util.inherits(InputNsq, base_input.BaseInput);

InputNsq.prototype.start = function(callback) {

  logger.info('Start NSQ listener', 'channel', this.channel, 'topic', this.topic);

	const reader = new nsq.Reader(this.topic, this.channel, {
	  lookupdHTTPAddresses: this.host+':'+this.port
	});
	reader.connect();
	reader.on('message', msg => {
	    logger.debug('Received message [%s]: %s', msg.id, msg.body.toString());
	    msg.finish();
	    this.emit('data', msg);
	}.bind(this));

  callback();
};

InputNsq.prototype.close = function(callback) {
  logger.info('Closing NSQ input', this.amqp_url, 'exchange ' + this.exchange_name);

};

exports.create = function() {
  return new InputNsq();
};
