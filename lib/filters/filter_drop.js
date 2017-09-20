var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

function FilterDrop() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Drop',
    start_hook: this.start,
  });
}

util.inherits(FilterDrop, base_filter.BaseFilter);

FilterDrop.prototype.start = function(callback) {
  logger.info('Initialized Drop Filter');
  callback();
};

FilterDrop.prototype.process = function(data) {
  this.emit('data', undefined);
};

exports.create = function() {
  return new FilterDrop();
};
