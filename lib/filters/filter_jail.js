var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

function FilterJail() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Jail',
    optional_params: ['target_field'],
    default_values: { target_field: 'data' },
    start_hook: this.start,
  });
}

util.inherits(FilterJail, base_filter.BaseFilter);

FilterJail.prototype.start = function(callback) {
  logger.info('Initializing Jail filter with target:', this.target_field);
  callback();
};

FilterJail.prototype.process = function(data) {
  var xd = {}; xd[this.target_field] = data.message || data;
  return xd;
};

exports.create = function() {
  return new FilterJail();
};
