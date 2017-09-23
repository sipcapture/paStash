var Gun = require('gun/gun');
require('gun/lib/memdisk');
require('gun/lib/later.js');

function config() {
  return {
    optional_params: [
      'gun_enabled',
      'gun_storage',
      'gun_index',
      'gun_ttl',
    ],
    default_values: {
      'gun_enabled': true,
      'gun_storage': false,
      'gun_index': 'gundata',
      'gun_ttl': 60 * 60 * 3,
    },
    start_hook: function(callback) {
      if (this.gun_enabled) {
        if (this.gun_storage) {
           this.gun = Gun({file: this.gun_index+'.json' });
        } else {
           this.gun = Gun();
        }
      }
      callback();
    },
  };
}

exports.config = config;
