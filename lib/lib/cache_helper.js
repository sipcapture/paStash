var lru = require('lru-cache');
var shared_cache = lru({max: this.cache_size, maxAge: this.cache_ttl * 1000});

function config() {
  return {
    optional_params: [
      'cache_enabled',
      'cache_size',
      'cache_ttl',
      'cache_shared'
    ],
    default_values: {
      'cache_enabled': true,
      'cache_size': 1000,
      'cache_ttl': 60 * 10,
      'cache_shared': false
    },
    start_hook: function(callback) {
      var __cache__;
      if (!this.cache_shared) __cache__ = lru({max: this.cache_size, maxAge: this.cache_ttl * 1000});
      else __cache__ = shared_cache;

      if (this.cache_enabled) {
        this.cache_do = function(key, value, callback) {
	    if (value) __cache__.set(key, value);
	    return callback(undefined, __cache__.get(key) );
        }.bind(this);
      }

      this.cache = function(key, callback) {
        var r;
        if (this.cache_enabled) {
          r = __cache__.get(key);
        }
        if (r) {
          return callback(undefined, r);
        }
        this.cache_miss(key, function(err, r) {
          if (err) {
            return callback(err);
          }
          if (this.cache_enabled) {
            __cache__.set(key, r);
          }
          return callback(undefined, r);
        }.bind(this));
      }.bind(this);
      callback();
    },
  };
}

exports.config = config;
