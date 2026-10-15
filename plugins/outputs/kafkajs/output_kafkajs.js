var base_output = require('@pastash/pastash').base_output,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

const { Kafka } = require('kafkajs')
var Logger;

function OutputKafka() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('json_logstash'));
  this.mergeConfig({
    name: 'Kafka',
    optional_params: ['kafkaHost', 'topic', 'partition', 'threshold_down', 'debug', 'sasl_user', 'sasl_pass' ],
    default_values: {
      debug: false,
      threshold_down: 10,
      topic: false,
      partition: false,
      sasl_user: false
    },
    start_hook: this.start,
  });
}

util.inherits(OutputKafka, base_output.BaseOutput);

OutputKafka.prototype.start = async function(callback) {

  if(!this.kafkaHost) return;

  var kconf = {
  	clientId: 'paStash',
  	brokers: [this.kafkaHost]
  }

  if (this.sasl_user && this.sasl_pass){
      kconf.sasl = {
	    mechanism: 'scram-sha-256',
	    username: this.sasl_user,
	    password: this.sasl_pass,
      }
  }
  this.kafka = new Kafka(kconf);
  this.producer = this.kafka.producer()
  await this.producer.connect()

  this.producer.on('error', (err) => {
    logger.warning('Kafka Client Error:', err);
    this.error_count++;
  });
  this.producer.on('ready', () => {
    console.log('Kafka Client Ready!');
    this.error_count = 0;
  });

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

OutputKafka.prototype.process = async function(data) {

  var d = [{ topic: this.topic, messages: JSON.stringify(data) }];
  try {
    if (this.partition){
      if (data.message) {
	if (typeof data.message != 'object') data.message = JSON.parse(data.message);
        d[0].key = data.message[this.partition];
      } else {
        d[0].key = data[this.partition];
      }
    }
  } catch (e) {
    if (this.debug) logger.info("No value found for partition key", this.partition );
  }

  if (this.debug) logger.info("Preparing to send to Kafka\n", d[0], "\n\n" );
  try {
    await this.producer.send(d)
  } catch (e) {
    logger.error(e);
  }

};

OutputKafka.prototype.close = async function(callback) {
  logger.info('Closing Kafka Output to', this.kafkaHost);
  await producer.disconnect()
  callback();
};

exports.create = function() {
  return new OutputKafka();
};
