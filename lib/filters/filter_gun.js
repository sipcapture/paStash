/* 
GunDB Alpha-Filter
QXIP BV (http://qxip.net)
 */

var base_filter = require('../lib/base_filter');
var  util = require('util'),
  Gun = require('gun'),
  logger = require('log4node');

var gun = Gun({file: 'pastash.json'}).get('pastash');


function FilterGun() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Gun',
    optional_params: ['target_field','write','source'],
    host_field: 'field',
    default_values: {
      'target_field': 'gun',
      'write': 'false' 
    },
    start_hook: this.start,
  });
}

util.inherits(FilterGun, base_filter.BaseFilter);

FilterGun.prototype.start = function(callback) {
  this.gun = gun;
  this.gunfire = function(key, data, callback) {
   // console.log(key,data);
   if (!data[this.field] && !this.write) { console.log('skip1'); callback('skip');  }
   else if (!data[this.source] && this.write) { console.log('skip2'); callback('skip');  }
   else {
    try {
        // console.log('GUN TIME!: '+key, this.write);
	if (this.write && this.source) {
		if(this.source.indexOf('.') !== -1) {
			console.log('split vars',data);
			var extract = this.source.split('.').reduce(function(a, b) {
			  return a[b];
			}, data);
		} else {
			var extract = data[this.source];
		}
    		if (!extract || !this.source) { 
			callback('skip source'); 
		} else {
		        console.log('GUN-W: '+key, this.source, extract);
		      	gun.get(key).get(this.source).put(extract);
		      	// gun.get(key).val(function(result, key){ console.log(key+' SAVED:',result); });
			callback('saved');
		}

	} else if (!this.write && this.target_field) {
	        // console.log('GUN-R: '+key);
	      	gun.get(key).val(function(result, key){
			if (!result || result == 'undefined') {
				callback('nores'); 
			} else { 
				delete result._;
				delete result['#'];
				if (Object.keys(result).length === 0){
					callback('skip');
				} else {
			    		console.log("GUNDB "+key+" GOT:", result);
					// data[this.target_field] = result;
					// console.log('MOD!',data); 
					callback(undefined,result);
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
   }
  };
  callback();
};

FilterGun.prototype.process = function(data) {
  if (data[this.field] && !this.write) {
    this.gunfire(data[this.field], data, function(err, result, newdata) {
      if (err) {
	return data;
      } else if (newdata) { this.emit('output',newdata);
      } else if (!err) {
        data[this.target_field] = result;
      }
      this.emit('output', data);
    }.bind(this));
  }
  else {
    return data;
  }
};

exports.create = function() {
  return new FilterGun();
};
