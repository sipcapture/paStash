var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

/* omit & pick functions */
var wlist = function(obj,whitelist){
  return Object.keys(obj).filter((key) => whitelist.indexOf(key) >= 0).reduce((newObj, key) => Object.assign(newObj, { [key]: obj[key] }), {});
}
var blist = function(obj,blacklist){
 return Object.keys(obj).filter((key) => blacklist.indexOf(key) < 0).reduce((newObj, key) => Object.assign(newObj, { [key]: obj[key] }), {});
}

function FilterOmit() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Omit',
    optional_params: ['whitelist', 'blacklist'],
    start_hook: this.start,
  });
}

util.inherits(FilterOmit, base_filter.BaseFilter);

FilterOmit.prototype.start = function(callback) {
  var msg = '';
  if (this.blacklist && this.whitelist) msg = 'Double settings, only Blacklist enabled!';
  logger.info('Initialized Omit filter!',msg);
  callback();
};

FilterOmit.prototype.process = function(data) {
  if (this.blacklist) {
    return blist(data, this.blacklist);
  } else if (this.whitelist) {
    return wlist(data, this.whitelist);
  } else {
    return data;
  }
};

exports.create = function() {
  return new FilterOmit();
};
