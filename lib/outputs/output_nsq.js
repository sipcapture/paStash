var base_output = require('../lib/base_output'),
  util = require('util'),
  logger = require('log4node');

var Publisher = require('nsq-publisher');

function OutputNsq() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('json_logstash'));
  this.mergeConfig({
    name: 'NSQ',
    optional_params: ['protocol', 'topic', 'dataUrl', 'dataHttpPort', 'dataTcpPort', 'autoCreate', 'debug' ],
    default_values: {
	debug: false,
	autoCreate: true,
	protocol: 'http',
	dataUrl: 'localhost',
	topic: 'hepic'
    },
    start_hook: this.start,
  });
}

util.inherits(OutputNsq, base_output.BaseOutput);

OutputNsq.prototype.start = function(callback) {

  if(!this.topic||this.dataUrl) return;

  logger.info('Initializing NSQ Publisher...');
  this.pub = new Publisher({
  	dataUrl: this.dataUrl, // optional
  	dataHttpPort: this.dataHttpPort || 4151, // optional
  	dataTcpPort: this.dataTcpPort || 4150, // optional
  	topic: this.topic, 
  	protocol: this.protocol, // optional
  	autoCreate: this.autoCreate // optional
  });
  logger.info('Initializing NSQ Topic', this.topic);
  pub.createTopic(function (err) {
    if (err) {
  	logger.error(err);
	return;
    } else {
  	logger.info('NSQ Publisher initialized!');
    }
  });

  callback();
};

OutputNsq.prototype.process = function(data) {

	this.pub.publish(data, function (err) {
	  if (err) {
	  	logger.error(err);
	  } else {
	  	logger.debug('NSQ message published');
	  }
	});
};

OutputNsq.prototype.close = function(callback) {
  logger.info('Closing NSQ Output for Topic', this.topic);
  callback();
};

exports.create = function() {
  return new OutputNsq();
};
