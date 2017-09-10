var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var Mustache = require('mustache');

function FilterMustache() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Mustache',
    required_params: ['template'],
    optional_params: ['target_field'],
    host_field: 'source_field',
    start_hook: this.start,
  });
}

util.inherits(FilterMustache, base_filter.BaseFilter);

FilterMustache.prototype.start = function(callback) {
  if (!this.target_field) {
    this.target_field = this.source_field;
  }
  logger.info('Initializing Mustache filter with template', this.template);
  callback();
};

FilterMustache.prototype.process = function(data) {
  var x = data.message || data;
  if (x) {
    try {
      var result = Mustache.render(this.template, x);
      if (result !== undefined && result !== null && (typeof result === 'string' || ! isNaN(result)) && result !== Infinity) {
        data[this.target_field] = result;
      }
    }
    catch(err) {}
  }
  return data;
};

exports.create = function() {
  return new FilterMustache();
};
