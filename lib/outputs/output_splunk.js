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
    optional_params: ['token','splunk_url','batchInterval','maxBatchCount','maxBatchSize', 'debug', 'index','sourcetype', 'source', 'host', 'timefield', 'flat', 'threshold_down', 'check_interval'],
    default_values: {
    	batchInterval: 1000,
    	maxBatchCount: 10,
    	maxBatchSize: 1024,
	threshold_down: 10,
	check_interval: false,
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
  if (this.flat) {
	Logger.eventFormatter = function(message, severity) {
		var event;
		try {
			event = JSON.parse(message);
		} catch(err){
			if (this.debug) logger.warning("Splunk eventFormatter:", err, message); 
			event = message;	
		}
		return event;
	};
  }
  logger.info('Creating Splunk Output to', this.splunk_url);

  if (this.check_interval) {
    if (this.check_interval < 1000) this.check_interval = 1000;
    logger.info('Splunk Check timer every ' + this.check_interval + 'ms');
    this.check_interval_id = setInterval(function() {
      this.check();
    }.bind(this), this.check_interval);
  }	
  this.on_alarm = false;
  this.error_count = 0;
	
  callback();
};

OutputSplunk.prototype.check = function() {
  if (this.on_alarm) {
    if (this.threshold_down && this.error_count < this.threshold_down) {
      logger.warning('Splunk socket end of alarm', this.splunk_url);
      this.on_alarm = false;
      this.emit('alarm', false, this.splunk_url);
      this.error_count = 0;
    }
    else {
      logger.info('Splunk socket still in alarm : errors : ', this.error_count );
    }
  }
};

OutputSplunk.prototype.process = function(data) {

	var metadata;
	if (this.metadata) {
	   metadata = this.metadata;
	   if (this.timefield) {
		if (data[this.timefield]) {
			metadata.time = data[this.timefield];
		}
  	   }
	}
	
	var d = {};
	d.metadata = metadata || {};
	d.message = data;
	
	if (this.debug) logger.info('Output to Splunk',d);
	Logger.send(d, function(err, resp, body) {
		if (err) { 
		   this.error_count++;
		   if (this.error_count > this.threshold_down){
		     this.on_alarm = true;
		     this.emit('alarm', true, this.address);
		   }
		   if (this.debug) logger.warning("Splunk Error:", err, this.error_count); 
		}
		if (this.error_count > 0) this.error_count--;
    		if (this.debug) logger.info("Response from Splunk:", body);
	});
};

OutputSplunk.prototype.close = function(callback) {
  if (this.check_interval_id) {
    logger.info('Clearing Splunk Check timer, Exit error count:', this.error_count );
    clearInterval(this.check_interval_id);
  }
  logger.info('Closing Splunk Output to', this.splunk_url);
  callback();
};

exports.create = function() {
  return new OutputSplunk();
};
