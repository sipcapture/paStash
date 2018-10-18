var base_filter = require('../lib/base_filter'),
  util = require('util');

function FilterAddTimestampField() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AddTimestampField',
    required_params: ['field'],
  });
}

util.inherits(FilterAddTimestampField, base_filter.BaseFilter);

FilterAddTimestampField.prototype.process = function(data) {
  data[this.field] = Date().now();
  return data;
};

exports.create = function() {
  return new FilterAddTimestampField();
};

