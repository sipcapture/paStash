/* 
GunDB-R Alpha-Filter
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

function FilterGunRead() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig(gun_helper.config());
  this.mergeConfig({
    name: 'GunRead',
    optional_params: ['target_field', 'field', 'source'],
    default_values: {
      'target_field': 'gun',
      'write': 'false'
    },
    start_hook: this.start,
  });
}

util.inherits(FilterGunRead, base_filter.BaseFilter);

FilterGunRead.prototype.start = function(callback) {
  callback();
};

FilterGunRead.prototype.process = function(data) {

  if (!data[this.target_field]) {
        var rvalue = Extract(this.field,data);
        //this.emit('output', data);
	console.log('GUNREAD',rvalue,this.field,this.source);
        this.gun.get(rvalue).val(function(result,key) {
		console.log('GUNREAD-OUT',result,key);
		//delete result._;
		//delete result['#'];
	 	// if (result) { data[this.target_field] = result; }
		for(var i in result){
			data[this.target_field] = result[i];
		}
		// data[this.target_field] = { gun: JSON.stringify(result) };
	      this.emit('output',data);
        }.bind(this));
  }
  else {
    // console.log('SENDING:',data.type)
    return data;
  }
};

exports.create = function() {
  return new FilterGunRead();
};
