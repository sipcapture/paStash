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
    optional_params: ['kafkaHost', 'topic', 'partition', 'partition_default', 'threshold_down', 'check_interval', 'debug' ],
    default_values: {
	debug: false,
	topic: 'hepic',
	partition_default: 'hepic',
	threshold_down: 10
    },
    start_hook: this.start,
  });
}

util.inherits(OutputKafka, base_output.BaseOutput);

OutputKafka.prototype.start = function(callback) {

  if(!this.kafkaHost) return;

  var client = new kafka.KafkaClient({ kafkaHost: this.kafkaHost });
  var Producer = kafka.Producer;
  var options = {};
  if (this.partition) {  
    var options = { partitionerType: Producer.PARTITIONER_TYPES["keyed"] };
  }
  this.producer = new Producer(client,options);
  this.producer.on('error', (err) => {
    logger.warning('Kafka Client Error:', err);
    this.error_count++;
  });
  this.producer.on('ready', () => {
    console.log('Kafka Client Ready!');
    this.error_count = 0;
  });
	
  if (this.check_interval) {
    if (this.check_interval < 1000) this.check_interval = 1000;
    logger.info('Kafka Check timer every ' + this.check_interval + 'ms');
    this.check_interval_id = setInterval(function() {
      this.check();
    }.bind(this), this.check_interval);
  }	
  this.on_alarm = false;
  this.error_count = 0;
	
  logger.info('Creating Kafka Output to', this.kafkaHost);
  callback();
};

OutputKafka.prototype.check = function() {
  if (this.on_alarm) {
    if (this.threshold_down && this.error_count < this.threshold_down) {
      logger.warning('Kafka socket end of alarm', this.kafkaHost);
      this.on_alarm = false;
      this.emit('alarm', false, this.kafkaHost);
      this.error_count = 0;
    }
    else {
      logger.info('Kafka socket still in alarm : errors : ', this.error_count );
    }
  }
};

OutputKafka.prototype.process = function(data) {
		
	var d = [{ topic: this.topic, messages: JSON.stringify(data) }];
	try {
	  if (this.partition) {
	    if (data.message && data.message[this.partition]) {
	      d[0].key = data.message[this.partition];
	    }
	  }
	  if (this.debug) logger.info("Preparing to send to Kafka", d[0] );
	  this.producer.send(d, function(err, result) {
		if (err) {
		  logger.warning("Kafka Producer Error:", err);
		  this.error_count++;
		  if (this.error_count > this.threshold_down){
		    this.on_alarm = true;
		    this.emit('alarm', true, this.kafkaHost);
		  }
		}
		if (this.error_count > 0) this.error_count--;
		if (this.debug) logger.info("Response from Kafka:", result);
	  });		
	} catch (e) { logger.error(e); }
};

OutputKafka.prototype.close = function(callback) {
  if (this.check_interval_id) {
    logger.info('Clearing Kafka Check timer. Exit error count:',this.error_count);
    clearInterval(this.check_interval_id);
  }
  logger.info('Closing Kafka Output to', this.kafkaHost);
  callback();
};

exports.create = function() {
  return new OutputKafka();
};
