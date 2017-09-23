/* 
GunDB-W Alpha-Filter
QXIP BV (http://qxip.net)
 */

var base_filter = require('../lib/base_filter');
var  util = require('util'),
  logger = require('log4node');

var gun_helper = require('../lib/gun_helper');
var gun = gun_helper.gun;

function FilterGunWrite() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig(gun_helper.config());
  this.mergeConfig({
    name: 'GunWrite',
    optional_params: ['write','source', 'ttl'],
    host_field: 'field',
    default_values: {
      'write': 'true'
      'ttl': 0
    },
    start_hook: this.start,
  });
}

util.inherits(FilterGunWrite, base_filter.BaseFilter);

FilterGunWrite.prototype.start = function(callback) {
  
  this.gunfire = function(key, data, callback) {
   if (!this.field && !this.write) { callback(true);return;  }
   else {
    try {
	if (this.write && this.source) {
		if(this.source.indexOf('.') !== -1) {
			var extract = this.source.split('.').reduce(function(a, b) {
			  return a[b];
			}, data);
		} else {
			var extract = data[this.source];
		}
    		if (!extract || !this.source) { 
			callback('no data! skip'); 
		} else if (this.ttl && this.ttl != 0){
			gun.get(key).get(this.source).put(extract).later(function(data, key){
  				this.get('session').put(null);
			}, this.ttl);
			callback('saved w/ ttl '+this.ttl);
	 	} else {
		      	gun.get(key).get(this.source).put(extract);
			callback('saved');
		}

	} else {
		callback('skip');
	}
    }
    catch(e) {
      console.log('OUCH!',e);
      callback(e);
    }
   }
  };
  callback();

};

FilterGunWrite.prototype.process = function(data) {

  if (data[this.field]) {
      this.gunfire(data[this.field], data, function(err, result) {
      if (!err) { data[this.target_field] = result }
        this.emit('output',data);
      }.bind(this));
  }
  else {
    return data;
  }
};

exports.create = function() {
  return new FilterGunWrite();
};
