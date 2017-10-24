var base_output = require('../lib/base_output'),
  util = require('util'),
  logger = require('log4node');

var kafka = require('kafka-node');
var Producer = kafka.Producer;
var KeyedMessage = kafka.KeyedMessage;
var Client = kafka.Client;

var Logger;

function OutputKafka() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('json_logstash'));
  this.mergeConfig({
    name: 'Kafka',
    optional_params: ['kafkaHost', 'topic' ],
    default_values: {
	debug: false,
	topic: 'hepic' 
    },
    start_hook: this.start,
  });
}

util.inherits(OutputKafka, base_output.BaseOutput);

OutputKafka.prototype.start = function(callback) {

  if(!this.kafkaHost) return;

  var client = new kafka.KafkaClient({ kafkaHost: this.kafkaHost });
  var Producer = kafka.Producer;
  this.producer = new Producer(client);
  this.producer.on('error', (err) => {
    logger.info('Kafka Client Error:', err);
  });
  this.producer.on('ready', () => {
    console.log('Kafka Client Ready!');
  });

  logger.info('Creating Kafka Output to', this.kafkaHost);
  callback();
};

OutputKafka.prototype.process = function(data) {
	var d = [{ topic: this.topic, message: JSON.stringify(data) }];
	if (this.debug) console.log("Preparing to send to Kafka",d );
	this.producer.send(d, function(err, result) {
		if (this.debug && err) console.log("Kafka Producer Error:", err);
    		if (this.debug) console.log("Response from Kafka:", result);
	});
};

OutputKafka.prototype.close = function(callback) {
  logger.info('Closing Kafka Output to', this.kafkaHost);
  callback();
};

exports.create = function() {
  return new OutputKafka();
};
