/* 
Base Aggregation / Stats
QXIP BV (http://qxip.net)
 */

var base_filter = require('../lib/base_filter');
var base_aggs = require('../lib/base_aggs');
var  util = require('util'),
  logger = require('log4node');

function FilterAggs() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig(base_aggs.config());
  this.mergeConfig({
    name: 'FilterAggs',
    required_params: [ 'name', 'field' ],
    optional_params: [ 'reporter', 'intervalMS', 'reportZeros', 'counter', 'passthrough'],
    default_values: {
      intervalMS: 1000,
      reportZeros: true,
      counter: false,
      passthrough: false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAggs, base_filter.BaseFilter);

FilterAggs.prototype.start = function(callback) {
  this.stats = base_aggs.create(this.name);
  callback();
};

FilterAggs.prototype.process = function(data) {
  var aggdata = data.message || data;
  if (this.counter) {
    this.stats.increment(this.field,aggdata[this.field]);
  } else {
    this.stats.statistics(this.field,aggdata[this.field])
  }
  if(this.passthrough) return data;
};

exports.create = function() {
  return new FilterAggs();
};
