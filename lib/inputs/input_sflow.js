var base_input = require('../lib/base_input'),
  util = require('util'),
  logger = require('log4node');
  
var Collector = require('node-sflow');

function InputSflow() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Sflow',
    port_field: 'port',
    optional_params: ['uuid'],
    start_hook: this.start,
  });
}

util.inherits(InputSflow, base_input.BaseInput);

InputSflow.prototype.start = function(callback) {
  this.port = this.parsed_url.params.port;
  this.host = this.parsed_url.params.host;
  this.raw = this.parsed_url.params.raw ? this.parsed_url.params.raw : false;
  logger.info('Opening Sflow socket on port '+this.port);

  this.socket = Collector({port: this.port });

  this.socket.on("error", function (error) {
      logger.info('Sflow Connection Error ' + JSON.stringify(error));
      this.emit('error', error);
  }).on('data', function(data) {
      if (!flow && !flow.flow.records && !flow.flow.records.length>0) return;
	// console.log('got data..');
	flow.flow.records.forEach(function(n) {
		if(n.type != 'raw') {
	        	this.emit('data', n);
		}
	}.bind(this));
  }.bind(this));

  callback();

};

InputSflow.prototype.close = function(callback) {
  logger.info('Closing Sflow socket');
  try { this.socket.close(); } catch(err){ console.log('failed killing socket...'); }; 
  callback();
};

exports.create = function() {
  return new InputSflow();
};
