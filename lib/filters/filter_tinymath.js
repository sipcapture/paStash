var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');
  
const evaluate = require('tinymath').evaluate;

function FilterTinymath() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Tinymath',
    optional_params: ['target_field', 'expression', 'function'],
    default_values: {
      target_field: 'tinymath',
      function: {} // { plustwo: function(a) { return a+2 } }
    },
    start_hook: this.start,
  });
}

util.inherits(FilterTinymath, base_filter.BaseFilter);

FilterTinymath.prototype.start = function(callback) {
  logger.info('Initializing Tinymath filter with target:', this.target_field);
  callback();
};

FilterTinymath.prototype.process = function(data) {
  var out = data.message || data;
  try {
	out[this.target_field] = evaluate(this.expression,out,this.function);
  	return out;
  } catch(e) { logger.error(e); return out; }

};

exports.create = function() {
  return new FilterTinymath();
};
