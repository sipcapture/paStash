var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var SIP = require('sipcore');

function FilterSipParser() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'SipParser',
    required_params: ['source_field'],
    start_hook: this.start,
  });
}

util.inherits(FilterSipParser, base_filter.BaseFilter);

FilterSipParser.prototype.start = function(callback) {
  logger.info('Initialized SIP parser from field ' + this.source_field);
  callback();
};

FilterSipParser.prototype.process = function(data) {
  if (data[this.source_field]) {
    try {
      data[this.source_field] = SIP.parse(data[this.source_field]);
    } 
    catch (e) {
      logger.error('Failed parsing SIP',e);
    }
  }
  return data;
};

exports.create = function() {
  return new FilterSipParser();
};
