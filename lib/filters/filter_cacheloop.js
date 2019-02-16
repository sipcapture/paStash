var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var recordCache = require('record-cache');

/* omit & pick functions */
var omit = require('object.omit');
var wlist = function(obj,whitelist){
  return Object.keys(obj).filter((key) => whitelist.indexOf(key) >= 0).reduce((newObj, key) => Object.assign(newObj, { [key]: obj[key] }), {});
}
var blist = function(obj,blacklist){
 return Object.keys(obj).filter((key) => blacklist.indexOf(key) < 0).reduce((newObj, key) => Object.assign(newObj, { [key]: obj[key] }), {});
}


function FilterCacheloop() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'CacheLoop',
    optional_params: ['cacheSize','cacheAge','extract','groupBy','mean','bypass','custom_type','blacklist','whitelist','count','average', 'rename'],
    default_values: {
      'cacheSize': 5000,
      'cacheAge': 10000,
      'extract': 'correlation_id',
      'bypass': true,
      'custom_type': false,
      'blacklist': false,
      'whitelist': false,
      'clone': false,
      'count': 'count',
      'average': false,
      'rename': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterCacheloop, base_filter.BaseFilter);

FilterCacheloop.prototype.start = function(callback) {
  logger.info('Initialized Cacheloop Filter');
  var onStale = function(data){
    //logger.info('processing stales...',data);
    for (let [key, value] of data.records.entries()) {
      var records = []; var output = {};
      value.list.forEach(function(row){
        records.push(row.record);
      });
      if (records.length == 0||!records.length) return;
      output[key] = records;
      output[this.extract] = key;
      if (this.count) output[this.count] = records.length;
      if(this.custom_type) output['type'] = this.custom_type;

      if(this.average && this.average.constructor === Array ){
        this.average.forEach(function(field){
                var tmp = 0;
                var items = 0;
                output[Object.keys(output)[0]].forEach(function(rec){
                        items++;
                        if(rec[field] && !isNaN(rec[field])){
                                tmp += rec[field]
                        }
                });
                tmp = parseInt(tmp / items);
                if (tmp && tmp>0) output['avg_'+field] = tmp;
        });
      } else if(this.average && this.average.constructor === String ){
		var field = this.average;
                var tmp = 0;
                var items = 0;
                output[Object.keys(output)[0]].forEach(function(rec){
                        if(rec[field] && !isNaN(rec[field])){
				items++;
                                tmp += rec[field]
                        }
                });
                tmp = parseInt(tmp / items);
                if (tmp && tmp>0) output['avg_'+field] = tmp;
      }

      if (this.clone && this.clone.length == 5){

	 // CLONE: [0]field, [1]match src key, [2]match src value, [3]match dst key, [4]match dst value;
	 var src = output[Object.keys(output)[0]].find(function(element) {
	    if (element[clone[1]] == clone[2]) return output[Object.keys(output)[0]][clone[0]];
	 });
	 output[Object.keys(output)[0]].find(function(element) {
	    if (element[clone[3]] == clone[4]) element[clone[0]] = src;
	 });

      }

      if (this.rename) {
        output[this.rename] = output[key];
        delete output[key];
      }


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
  if (data[this.extract]) {
    if (this.whitelist) {
	 this.cache.add(data[this.extract], wlist(data, this.whitelist));
    } else if (this.blacklist) {
	this.cache.add(data[this.extract], blist(data, this.blacklist));
    } else {
	this.cache.add(data[this.extract], data);
    }
  }
  // forward original
  if (this.bypass) this.emit('output', data);
};

exports.create = function() {
  return new FilterCacheloop();
};
