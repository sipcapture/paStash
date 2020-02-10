/*
   Custom, Unoptimized OpenSIPS CDR Parser
   (C) 2017 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

function FilterAppCdr() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppCdr',
    start_hook: this.start,
  });
}

util.inherits(FilterAppCdr, base_filter.BaseFilter);

FilterAppCdr.prototype.start = function(callback) {
  logger.info('Initialized App OpenSIPS CDR parser');
  callback();
};


FilterAppCdr.prototype.process = function(data) {

   if (!data.message) return data;
   var line = data.message;
   if (line.indexOf('ended: ') !== -1) {
        var regex = /ended: (.*)/g;
        var cdr = regex.exec(line);
        if (!cdr || !cdr[1]) return;
        var split_cdr = cdr[1].split(';');
        var out_cdr = {};
        split_cdr.forEach(function(row){
                var tmp = row.split('=');
                out_cdr[tmp[0]] = tmp[1];
        });
        this.emit('output',out_cdr);
   }
};

exports.create = function() {
  return new FilterAppCdr();
};
