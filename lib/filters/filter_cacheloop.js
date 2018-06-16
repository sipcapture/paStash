var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var recordCache = require('record-cache');

function FilterCacheloop() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'CacheLoop',
    optional_params: ['cacheSize','cacheAge','extract'],
    default_values: {
      'cacheSize': 5000,
      'cacheAge': 10000,
      'extract': 'correlation_id',
      'bypass': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterCacheloop, base_filter.BaseFilter);

FilterCacheloop.prototype.start = function(callback) {
  logger.info('Initialized Drop Filter');
  this.onStale = function(data){
    for (let [key, value] of data.records.entries()) {
      var records = []; var output = {};
      value.list.forEach(function(row){
        records.push(row.record);
      });
      if (records.length == 0||!records.length) return;
      output[key] = records;
      this.emit('data',output);
    }
  }.bind(this);

  this.cache = recordCache({
    maxSize: this.cacheSize,
    maxAge: this.cacheAge,
    onStale: this.onStale
  }.bind(this));

  callback();
};

FilterCacheloop.prototype.process = function(data) {
  // cache by extraction
  if (data[this.extract]) this.cache.add(data[this.extract], data);
  // forward original
  if (this.bypass) this.emit('data', data);
};

exports.create = function() {
  return new FilterCacheloop();
};
