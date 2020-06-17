/*
   Custom, Unoptimized SESM CSV Log to SIP/HEP3 Parser w/ reassembly of rows
   (C) 2020 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var moment = require('moment');

function FilterAppSESMLog() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppSESMLog',
    optional_params: ['debug'],
    default_values: {
      'debug': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppSESMLog, base_filter.BaseFilter);

FilterAppSESMLog.prototype.start = function(callback) {
  logger.info('Initialized App SESM SysLog to SIP/HEP parser');
  callback();
};

FilterAppSESMLog.prototype.process = function(data) {

   var line = data.message || data;
   var p = line.split(',');
   if (!line||!p) return;
   var timestamp = Date.parse(p[0]+" "+p[1]);
   var tags = 'system='+p[2]+',type='+p[3];
   var metric = p[4];
   var fieldset = [];
   // parse field pairs
   for(var i:int = 5; i < p.length; i+=2){ fieldset.push(p[i]+'='+p[i+1]) }
   var str = metric+','+tags+' '+fieldset.join(',')+' '+timestamp +''+'000000');
   this.emit('output', { "message": str } );
};

exports.create = function() {
  return new FilterAppSESMLog();
};
