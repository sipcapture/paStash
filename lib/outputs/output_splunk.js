var base_output = require('../lib/base_output'),
  util = require('util'),
  logger = require('log4node');

var SplunkLogger = require("splunk-logging").Logger;
var Logger;

function OutputSplunk() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('json_logstash'));
  this.mergeConfig({
    name: 'Splunk',
    optional_params: ['token','splunk_url','batchInterval','maxBatchCount','maxBatchSize'],
    default_values: {
    	batchInterval: 1000,
    	maxBatchCount: 10,
    	maxBatchSize: 1024 
    },
    start_hook: this.start,
  });
}

util.inherits(OutputSplunk, base_output.BaseOutput);

OutputSplunk.prototype.start = function(callback) {
  var config = {};
  if (this.token) config.token = this.token;
  if (this.splunk_url) config.url = this.splunk_url;
  config.batchInterval = this.batchInterval;
  config.maxBatchCount = this.maxBatchCount;
  config.maxBatchSize = this.maxBatchSize;
  Logger = new SplunkLogger(config);
  Logger.error = function(err, context) { logger.info(err); };
  logger.info('Creating Splunk Output to', this.splunk_url);
  callback();
};

OutputSplunk.prototype.process = function(data) {
	var d = { message: data };
	Logger.send(d);
};

OutputSplunk.prototype.close = function(callback) {
  logger.info('Closing Splunk Output to', this.splunk_url);
  callback();
};

exports.create = function() {
  return new OutputSplunk();
};
