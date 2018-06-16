/*
   Custom, Unoptimized Kamailio CDR parser
   (C) 2018 QXIP BV
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

function FilterAppCdr() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppCdr',
    start_hook: this.start,
  });
}

util.inherits(FilterAppCdr, base_filter.BaseFilter);

FilterAppCdr.prototype.start = function(callback) {
  logger.info('Initialized App Kamailio CDR parser');
  callback();
};


FilterAppCdr.prototype.process = function(data) {

   if (!data.message) return data;
   var line = data.message;
   if (line.indexOf('cdr\(\): ') !== -1) {
        var regex = /cdr\(\): (.*)/g;
        var cdr = regex.exec(line);
        if (!cdr || !cdr[1]) return;
        var split_cdr = cdr[1].split(';');
        var out_cdr = {};
        split_cdr.forEach(function(row){
                var tmp = row.split('=');
                out_cdr[tmp[0].trim()] = tmp[1];
        });
        this.emit('output',out_cdr);
   }
};

exports.create = function() {
  return new FilterAppCdr();
};
