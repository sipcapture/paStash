var base_output = require('../lib/base_output'),
  util = require('util'),
  logger = require('log4node');
  
var InfluxMetrics = require('metrics-influxdb');

function OutputInfluxdb() {
  base_output.BaseOutput.call(this);
  this.mergeConfig({
    name: 'Influxdb',
    required_params: ['metric_type', 'metric_key'],
    optional_params: ['metric_value', 'port', 'host', 'protocol', 'tags', 'username', 'password', 'database', 'interval'],
    default_values: {
      host: '127.0.0.1',
      protocol: 'udp',
      interval: 1000
    },
    start_hook: this.start,
  });
}

util.inherits(OutputKafka, base_output.BaseOutput);

OutputInfluxdb.prototype.start = function(callback) {
  var influxConfig = {};
  influxConfig.host = this.host;
  influxConfig.protocol = this.protocol;
  if (this.tags) influxConfig.tags = this.tags || {};
  if (this.port) influxConfig.port = this.port;
    if (this.username) influxConfig.username = this.username;
    if (this.password) influxConfig.password = this.password;
    if (this.database) influxConfig.database = this.database;
  this.reporter = new InfluxMetrics.Reporter(influxConfig);
  if (this.metric_type === 'counter') {
    if (!this.metric_value) {
      return callback(new Error('You have to specify metric_value with metric_type counter'));
    }
    var c = new InfluxMetrics.Counter();
    this.send = this.reporter.addMetric(this.metric_key, c);
    this.call = function(val){ c.inc(val); }
  }
  else if (this.metric_type === 'timer') {
    if (!this.metric_value) {
      return callback(new Error('You have to specify metric_value with metric_type timer'));
    }
    var t = new InfluxMetrics.Timer();
    this.send = reporter.addMetric(this.metric_key, t);
    this.call = function(val){ c.update(val); }
  }
  else if (this.metric_type === 'histogram') {
    if (!this.metric_value) {
      return callback(new Error('You have to specify metric_value with metric_type timer'));
    }
    var h = new InfluxMetrics.Histogram();
    this.send = reporter.addMetric(this.metric_key, h);
    this.call = function(val){ c.update(val); }
  }
  else if (this.metric_type === 'meter') {
    if (!this.metric_value) {
      return callback(new Error('You have to specify metric_value with metric_type timer'));
    }
    var m = new InfluxMetrics.Meter();
    this.send = reporter.addMetric(this.metric_key, m);
    this.call = function(val){ c.mark(val); }
  }
  else if (this.metric_type === 'gauge') {
    if (!this.metric_value) {
      return callback(new Error('You have to specify metric_value with metric_type gauge'));
    }
    var g = new InfluxMetrics.Gauge();
    this.send = reporter.addMetric(this.metric_key, g);
    this.call = function(val){ c.set(val); }
  }
  else {
    return callback(new Error('Wrong metric_type: ' + this.metric_type));
  }
  
  logger.info('Starting Influxdb reporter to', this.host + ' with interval '+this.interval);
  reporter.start(this.interval);
  callback();
};

OutputInfluxdb.prototype.process = function(data) {
  if (data[this.metric_value]){
     logger.debug('Sending '+ this.metric_type + ': '+this.metric_key + '=' + data[this.metric_value]);
     this.call( data[this.metric_value] );
  }
  callback();
};

OutputInfluxdb.prototype.close = function(callback) {
  logger.info('Closing Influxdb Output to', this.kafkaHost);
  this.reporter.stop() 
  callback();
};

exports.create = function() {
  return new OutputInfluxdb();
};
