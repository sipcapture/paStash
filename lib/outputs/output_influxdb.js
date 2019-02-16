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

util.inherits(OutputInfluxdb, base_output.BaseOutput);

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
    this.c = new InfluxMetrics.Counter();
    this.send = this.reporter.addMetric(this.metric_key, this.c);
    this.call = function(val){ this.c.inc(val); }
  }
  else if (this.metric_type === 'timer') {
    if (!this.metric_value) {
      return callback(new Error('You have to specify metric_value with metric_type timer'));
    }
    this.t = new InfluxMetrics.Timer();
    this.send = this.reporter.addMetric(this.metric_key, this.t);
    this.call = function(val){ this.t.update(val); }
  }
  else if (this.metric_type === 'histogram') {
    if (!this.metric_value) {
      return callback(new Error('You have to specify metric_value with metric_type timer'));
    }
    this.h = new InfluxMetrics.Histogram();
    this.send = this.reporter.addMetric(this.metric_key, this.h);
    this.call = function(val){ this.h.update(val); }
  }
  else if (this.metric_type === 'meter') {
    if (!this.metric_value) {
      return callback(new Error('You have to specify metric_value with metric_type timer'));
    }
    this.m = new InfluxMetrics.Meter();
    this.send = this.reporter.addMetric(this.metric_key, this.m);
    this.call = function(val){ this.m.mark(val); }
  }
  else if (this.metric_type === 'gauge') {
    if (!this.metric_value) {
      return callback(new Error('You have to specify metric_value with metric_type gauge'));
    }
    this.g = new InfluxMetrics.Gauge();
    this.send = this.reporter.addMetric(this.metric_key, this.g);
    this.call = function(val){ this.g.set(val); }
  }
  else {
    return callback(new Error('Wrong metric_type: ' + this.metric_type));
  }
  
  logger.info('Starting Influxdb reporter to', this.host + ' with interval '+this.interval);
  this.reporter.start(this.interval);
  callback();
};

OutputInfluxdb.prototype.process = function(data) {
  if (data[this.metric_value]){
     logger.debug('Sending '+ this.metric_type + ': '+this.metric_key + '=' + data[this.metric_value]);
     this.call( data[this.metric_value] );
  }
};

OutputInfluxdb.prototype.close = function(callback) {
  logger.info('Closing Influxdb Output to', this.host);
  this.reporter.stop() 
  callback();
};

exports.create = function() {
  return new OutputInfluxdb();
};
