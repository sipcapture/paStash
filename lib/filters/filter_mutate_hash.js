var base_filter = require('../lib/base_filter'),
  util = require('util'),
  moment = require('moment'),
  logger = require('log4node');

var murmur = require('murmur3');

function FilterMutateHash() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'MutateHash',
    host_field: 'field',
    start_hook: this.start,
  });
}

util.inherits(FilterMutateHash, base_filter.BaseFilter);

FilterMutateHash.prototype.start = function(callback) {
  logger.info('Initialized compute HASH filter on field: ' + this.field );
  callback();
};

FilterMutateHash.prototype.process = function(data) {
  if (data[this.field]) {
    data[this.field] = murmur.hash128(data[this.field]).hex();
  }
  return data;
};

exports.create = function() {
  return new FilterMutateHash();
};
