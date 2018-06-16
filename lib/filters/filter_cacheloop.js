var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var recordCache = require('record-cache');

function FilterCacheloop() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'CacheLoop',
    optional_params: ['cacheSize','cacheAge','extract','groupBy','mean','bypass','custom_type'],
    default_values: {
      'cacheSize': 5000,
      'cacheAge': 10000,
      'extract': 'correlation_id',
      'bypass': true,
      'custom_type': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterCacheloop, base_filter.BaseFilter);

FilterCacheloop.prototype.start = function(callback) {
  logger.info('Initialized Drop Filter');
  var onStale = function(data){
    logger.info('processing stales...',data);
    for (let [key, value] of data.records.entries()) {
      var records = []; var output = {};
      value.list.forEach(function(row){
        records.push(row.record);
      });
      if (records.length == 0||!records.length) return;
      output[key] = records;
      output[this.extract] = key;
      if(this.custom_type) output['type'] = this.custom_type;
      this.emit('output',output);
    }
  }.bind(this);
  onStale = onStale;

  var cache = recordCache({
    maxSize: this.cacheSize,
    maxAge: this.cacheAge,
    onStale: onStale
  });
  this.cache = cache;

  callback();
};

FilterCacheloop.prototype.process = function(data) {
  // cache by extraction
  if (data[this.extract]) this.cache.add(data[this.extract], data);
  // forward original
  if (this.bypass) this.emit('output', data);
};

exports.create = function() {
  return new FilterCacheloop();
};
