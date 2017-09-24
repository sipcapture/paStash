/* 
GunDB-W Alpha-Filter
QXIP BV (http://qxip.net)
 */

var base_filter = require('../lib/base_filter');
var  util = require('util'),
  logger = require('log4node');

var gun_helper = require('../lib/gun_helper');

var Extract = function(key,data){
   if(key.indexOf('.') !== -1) {
        return key.split('.').reduce(function(a, b) {
          return a[b];
        }, data);
   } else { return data[key]; }
}

function FilterGunWrite() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig(gun_helper.config());
  this.mergeConfig({
    name: 'GunWrite',
    optional_params: ['write','source', 'ttl', 'field'],
    default_values: {
      'write': 'true',
      'ttl': 0
    },
    start_hook: this.start,
  });
}

util.inherits(FilterGunWrite, base_filter.BaseFilter);

FilterGunWrite.prototype.start = function(callback) {
  
  this.gunfire = function(key, data, callback) {
   if (!this.field && !this.write) { callback(true);return; }
   else {
    try {
	if (this.write && this.source) {
		var extract = {}; extract[this.source] = Extract(this.source,data);
    		if (!extract || !this.source) {
			callback('no data! skip');
		} else if (this.ttl && this.ttl != 0){
			this.gun.get(key).put(extract).later(function(data, key){
				logger.info('Expiring key:',key);
  				this.get(key).put(null);
			}, this.ttl);
			callback('saved w/ ttl '+this.ttl);
	 	} else {
		      	this.gun.get(key).put(extract);
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
