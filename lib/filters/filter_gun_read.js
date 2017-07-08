/* 
GunDB-R Alpha-Filter
QXIP BV (http://qxip.net)
 */

var base_filter = require('../lib/base_filter');
var  util = require('util'),
  logger = require('log4node');

//var  Gun = require('gun');
//var gun = Gun({file: 'pastash.json'}).get('pastash');

var gun_helper = require('../lib/gun_helper');


function FilterGunRead() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Gun',
    optional_params: ['target_field'],
    host_field: 'field',
    default_values: {
      'target_field': 'gun',
      'write': 'false'
    },
    start_hook: this.start,
  });
}

util.inherits(FilterGunRead, base_filter.BaseFilter);

FilterGunRead.prototype.start = function(callback) {
  var gun = gun_helper.gun;

  this.gunfire = function(key, data, callback) {
    try {
        // console.log('GUN TIME!: '+key, this.write);
	if (this.target_field) {
	        console.log('GUN-R: '+key);
	      	gun.get(key).val(function(result, key){
			if (!result || result == 'undefined') {
				console.log('no results!',result);
				callback('nores'); 
			} else { 
				delete result._;
				delete result['#'];
				if (Object.keys(result).length === 0){
					callback('skip');
				} else {
			    		console.log("GUNDB "+key+" GOT:", result);
					data[this.target_field] = result;
					// console.log('MOD!',this.target_field,result);
					callback(false,result);
				}
			}
	  	}.bind(this));
	} else {
		callback('skip');
	}
    }
    catch(e) {
      console.log('OUCH!',e);
      callback(e);
    }
  };
  callback();

};

FilterGunRead.prototype.process = function(data) {

  if (data[this.field]) {
    //console.log('SURPASS!',data.type)
    //this.emit('output', data);
      this.gunfire(data[this.field], data, function(err, result) {
      if (!err) { data[this.target_field] = result; }
        this.emit('output',data);
      }.bind(this));
  }
  else {
    // console.log('BYPASS!',data.type)
    return data;
  }
};

exports.create = function() {
  return new FilterGunRead();
};
