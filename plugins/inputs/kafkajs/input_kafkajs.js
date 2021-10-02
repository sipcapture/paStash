var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

const { kafka } = require('kafkajs')

function InputKafkajs() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'kafkajs',
    optional_params: ['kafkaHost', 'topic', 'partition', 'threshold_down', 'debug', 'sasl_user', 'sasl_pass', 'fromBeginning' ],
    default_values: {
      debug: false,
      threshold_down: 10,
      topic: false,
      kafkaHost: false,
      fromBeginning: true,
      partition: false,
      sasl_user: false
    },
    start_hook: this.start,
  });
}

util.inherits(InputKafkajs, base_input.BaseInput);

InputKafkajs.prototype.start = async function(callback) {
  logger.info('Starting KafkaJS', this.topic);
  if(!this.kafkaHost||!this.topic) return;
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
  this.consumer = kafka.consumer({ groupId: 'paStash' })

  await this.consumer.connect()
  await consumer.subscribe({ topic: this.topic, fromBeginning: this.fromBeginning })

  this.consumer.on('error', (err) => {
    logger.warning('Kafka Client Error:', err);
    this.error_count++;
  });
  this.consumer.on('ready', () => {
    console.log('Kafka Client Ready!');
    this.error_count = 0;
  });

  await this.consumer.run({
    eachMessage: async ({ topic, partition, message }) => {

      var data = {
        partition,
        topic,
        message: message.value.toString(),
      };
      this.emit('data',data);

    }

  }.bind(this))

  callback();

};

InputKafkajs.prototype.close = async function(callback) {
  logger.info('Closing hyperswarm input', this.path);
  swarm.leave(this.path, callback())
  await this.consumer.disconnect()
};

exports.create = function() {
  return new InputKafkajs();
};
