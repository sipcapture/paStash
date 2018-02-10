var Gun = require('gun/gun');
require('gun/lib/memdisk');
require('gun/lib/later.js');
var shared_gun = Gun();

function config() {
  return {
    optional_params: [
      'gun_enabled',
      'gun_storage',
      'gun_index',
      'gun_ttl',
      'gun_shared'
    ],
    default_values: {
      'gun_enabled': true,
      'gun_shared': true,
      'gun_storage': false,
      'gun_index': 'gundata',
      'gun_ttl': 60 * 60 * 3,
    },
    start_hook: function(callback) {
      if (this.gun_enabled) {
       if (!this.gun_shared) {
          if (this.gun_storage) {
             this.gun = Gun({file: this.gun_index+'.json' });
          } else {
             this.gun = Gun();
          }
       } else { this.gun = shared_gun; }
      }
      callback();
    },
  };
}

exports.config = config;
