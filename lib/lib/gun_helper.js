var Gun = require('gun/gun');
require('gun/lib/memdisk');
var gun = Gun();

function config() {
  return {
    optional_params: [
      'gun_enabled',
      'gun_index',
      'gun_ttl',
    ],
    default_values: {
      'gun_enabled': true,
      'gun_index': 'gundata',
      'gun_ttl': 60 * 60 * 3,
    },
    start_hook: function(callback) {
      var __gun__;
      if (this.gun_enabled) {
        __gun__ = Gun({file: this.gun_index+'.json' });
      }
      callback();
    },
  };
}

exports.config = config;
exports.gun = gun;
