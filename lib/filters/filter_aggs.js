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
    optional_params: [ 'reporter', 'intervalMS', 'reportZeros', 'counter', 'pass'],
    default_values: {
      'intervalMS': 5000,
      'reportZeros': false,
      'counter': false,
      'pass': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAggs, base_filter.BaseFilter);

FilterAggs.prototype.start = function(callback) {

  // Timed Callback every ${intervalMS}
  var statscb = function(k,v){
	logger.info('CB:',k,v);
	this.emit('output',v);
  }.bind(this);
  this.stats = this.create(this.name, statscb, this.intervalMS, this.reportZeros);
  logger.info('Aggs module initialized');
  callback();
};

FilterAggs.prototype.process = function(data) {
  var aggdata = data.message || data;
  try {
	  aggdata = JSON.parse(aggdata);
	  if (!aggdata[this.field]){ logger.error( aggdata, aggdata[this.field], this.field, aggdata.count ); return; }
	  if (this.counter) {
	    this.stats.increment(this.field,aggdata[this.field]);
	  } else {
	    this.stats.statistics(this.field,aggdata[this.field]);
	  }
  } catch(e) { logger.error(e); }
  if(this.pass) return data;

};

exports.create = function() {
  return new FilterAggs();
};
