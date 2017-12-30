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
    optional_params: ['token','splunk_url','batchInterval','maxBatchCount','maxBatchSize', 'debug', 'index','sourcetype', 'source', 'host', 'timefield', 'flat'],
    default_values: {
    	batchInterval: 1000,
    	maxBatchCount: 10,
    	maxBatchSize: 1024,
	flat: false,
	debug: false
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
  config.debug = this.debug;
  // optional metadata block	
  if (this.index || this.sourcetype || this.source || this.host) {
	this.metadata = {};
	if (this.index) this.metadata.index = this.index;
	if (this.sourcetype) this.metadata.sourcetype = this.sourcetype;
	if (this.source) this.metadata.source = this.source; 
	if (this.host) this.metadata.host = this.host;
	logger.info('Set Splunk Metadata', this.metadata);
  }
  Logger = new SplunkLogger(config);
  Logger.error = function(err, context) { logger.info(err); };
  logger.info('Creating Splunk Output to', this.splunk_url);
  callback();
};

OutputSplunk.prototype.process = function(data) {
	if (this.metadata) {
	   var metadata = this.metadata || {};
	   if (this.timefield) {
		if (data[this.timefield]) {
			metadata.time = data[this.timefield];
		}
  	   }
	}
	
	var d = {};
	if (this.flat) {
		d = metadata || {};
		d.event = data;
	} else {
		d = { event: data };
		d.metadata = metadata || {};
	}
	
	if (this.debug) logger.info('Output to Splunk',d);
	Logger.send(d, function(err, resp, body) {
		if (this.debug && err) console.log("Splunk Error:", err);
    		if (this.debug) console.log("Response from Splunk:", body);
	});
};

OutputSplunk.prototype.close = function(callback) {
  logger.info('Closing Splunk Output to', this.splunk_url);
  callback();
};

exports.create = function() {
  return new OutputSplunk();
};
