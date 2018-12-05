var base_output = require('../lib/base_output'),
  ssl_helper = require('../lib/ssl_helper'),
  amqp_driver = require('../lib/amqp_driver'),
  util = require('util'),
  logger = require('log4node'),
  error_buffer = require('../lib/error_buffer');

/* IO Metrics */
var io = require('../lib/pmx_helper');
var metrics = false;
if (io) {
  metrics = {
        amqp_out_rps: io.meter({
          name: 'out req/sec',
          type: 'meter',
        }),
        amqp_out_err_rps: io.meter({
          name: 'out err req/sec',
          type: 'meter',
        }),
        amqp_out_err_driver: io.meter({
          name: 'connection err req/sec',
          type: 'meter',
        })
  };
}

function OutputAmqp() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('json_logstash'));
  this.mergeConfig(ssl_helper.config());
  this.mergeConfig(error_buffer.config(function() {
    return 'amqp to ' + this.host + ':' + this.port + ' exchange ' + this.exchange_name;
  }));
  this.mergeConfig({
    name: 'Ampq',
    host_field: 'host',
    port_field: 'port',
    required_params: ['exchange_name'],
    optional_params: ['topic', 'durable', 'retry_delay', 'heartbeat', 'username', 'password', 'vhost', 'persistent'],
    default_values: {
      'durable': true,
      'retry_delay': 3000,
      'heartbeat': 10,
      'persistent': false,
    },
    start_hook: this.start,

  });
}

util.inherits(OutputAmqp, base_output.BaseOutput);

OutputAmqp.prototype.start = function(callback) {
  this.amqp_url = amqp_driver.buildUrl(this);
  this.channel = undefined;
  logger.info('Start AMQP output to', this.amqp_url, 'exchange', this.exchange_name, 'topic', this.topic);


  this.connected_callback = function(channel) {
    channel.assertExchange(this.exchange_name, this.topic ? 'topic' : 'fanout', {durable: this.durable}, function(err) {
      if (err) {
        logger.error('Unable to create exchange', err);
	if (metrics) metrics.amqp_out_driver.mark();
      }
      else {
        this.channel = channel;
      }
    }.bind(this));
  }.bind(this);
  this.disconnected_callback = function() {
    this.channel = undefined;
  }.bind(this);
  this.amqp_logger = logger;

  this.driver = amqp_driver.createAmqpClient(this);

  callback();
};

OutputAmqp.prototype.process = function(data) {
  if (this.channel) {
    var options = {};
    if (this.persistent) {
      options.persistent = true;
    }
    this.channel.publish(this.exchange_name, this.topic || '', new Buffer(this.serialize_data(data)), options);
    if (metrics) metrics.amqp_out_rps.mark();
  }
};

OutputAmqp.prototype.close = function(callback) {
  logger.info('Closing AMQP output', this.amqp_url + ' exchange ' + this.exchange_name);
  this.driver.close(callback);
};

exports.create = function() {
  return new OutputAmqp();
};
