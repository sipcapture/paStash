/*
   Janus Event Tracer
   (C) 2022 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var recordCache = require("record-cache");
const xxhash = require("xxhash-wasm");
const { h32, h64 } = await xxhash();

function FilterAppJanusTracer() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppJanusTracer',
    optional_params: ['debug', 'cacheSize', 'cacheAge'],
    default_values: {
      'cacheSize': 50000,
      'cacheAge':  60000,
      'debug': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppJanusTracer, base_filter.BaseFilter);

FilterAppJanusTracer.prototype.start = function(callback) {

  var cache = recordCache({
    maxSize: this.cacheSize,
    maxAge: this.cacheAge,
    onStale: false
  });
  this.cache = cache;

  logger.info('Initialized App Janus Event Tracer');
  callback();
};

FilterAppJanusTracer.prototype.process = function(data) {
   if (!data.message) return data;
   var line = data.message;

   // when first event hits
   //   var fingerprint = h32(line.tags);
   //   this.cache.add(fingerprint, timestamp );
   // when last event hits
   //   var fingerprint = h32(line.tags);
   //   var root_ts = this.cache.get(fingerprint);
   //   var trace = { trace: data, duration: now() - root_ts  }
   //   this.emit('output', trace);

   return data;
};

exports.create = function() {
  return new FilterAppJanusTracer();
};
