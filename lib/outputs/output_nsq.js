var base_output = require('../lib/base_output'),
  util = require('util'),
  logger = require('log4node');

var nsq = require('nsqjs');

function OutputNsq() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('json_logstash'));
  this.mergeConfig({
    name: 'NSQ',
    optional_params: ['topic', 'dataUrl', 'dataTcpPort', 'debug', 'timeout', 'retries', 'stringify' ],
    default_values: {
	debug: false,
	stringify: true,
	timeout: 5000,
	retries: 10,
	dataTcpPort: 4150,
	dataUrl: 'localhost',
	topic: 'hepic'
    },
    start_hook: this.start,
  });
}

util.inherits(OutputNsq, base_output.BaseOutput);

OutputNsq.prototype.start = function(callback) {

  if (!this.topic||!this.dataUrl) { logger.error('Critical Error! Missing config!'); return; }
  logger.info('Initializing NSQ Publisher...');

  const w = new nsq.Writer(this.dataUrl, this.dataTcpPort);
  var count = 0;

  w.connect();
  w.on('ready', () => {
    logger.info('NSQ Writer Ready!');
    this.nsqw = w;
  });

  w.on('closed', () => {
    logger.error('NSQ Writer closed!');
    if (count < this.retries) {
	    logger.info('Reconnecting in '+this.timeout+'');
	    setTimeout(function(){ w.connect(); }, this.timeout);
    } else {
	logger.error('Giving up! Attempted:',this.retries);
   }
  });

  callback();
};

OutputNsq.prototype.process = function(data) {

	this.nsqw.publish(this.topic, this.stringify ? JSON.stringify(data) : data,  err => {
	    if (err) { logger.error(err.message); }
	    logger.debug('NSQ Message sent successfully!');
	});
};

OutputNsq.prototype.close = function(callback) {
  logger.info('Closing NSQ Output for Topic', this.topic);
  // this.nsqw.close();
  callback();
};

exports.create = function() {
  return new OutputNsq();
};
