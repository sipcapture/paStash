var base_filter = require('../lib/base_filter'),
  cache_helper = require('../lib/cache_helper'),
  util = require('util'),
  logger = require('log4node');

function FilterLRU() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig(cache_helper.config());
  this.mergeConfig({
    name: 'LRU',
    optional_params: ['field', 'value_field', 'target_field', 'action'],
    default_values: {
      'target_field': 'cache'
    },
    start_hook: this.start,
  });
}

util.inherits(FilterLRU, base_filter.BaseFilter);

FilterLRU.prototype.start = function(callback) {
  logger.info('Initialized LRU filter. Shared:',this.shared);
  callback();
};

FilterLRU.prototype.process = function(data) {
  if (this.action === 'set'){
  	logger.debug('LRU set... ',data[this.field],data[this.value_field]);
	this.cache_do(data[this.field], {value:data[this.value_field]}, function(err,result){
	      this.emit('output', data);
	}.bind(this));
  } else if (this.action === 'get'){
  	logger.debug('LRU get... ',data[this.field],data[this.value_field]);
	this.cache_do(data[this.field], null, function(err,result){
	      if (!err) data[this.target_field] = result;
	      this.emit('output', data);
	}.bind(this));

  } else {
  	return data;
  }
};

exports.create = function() {
  return new FilterLRU();
};
