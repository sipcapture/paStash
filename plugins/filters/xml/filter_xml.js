/*
   XML parser for @pastash/pastash
   (C) 2020 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var convert = require('xml-js');

function FilterAppXml() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppXML',
    optional_params: ['debug', 'compact', 'trim', 'alwaysChildren'],
    default_values: {
      'debug': false,
      'alwaysChildren': true,
      'compact': true,
      'ignoreComment': true,
      'trim': true
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppXml, base_filter.BaseFilter);

FilterAppXml.prototype.start = function(callback) {
  logger.info('Initialized XML parser');
  this.options = {ignoreComment: this.ignoreComment, alwaysChildren: this.alwaysChildren, compact: this.compact, trim: this.trim };
  callback();
};

FilterAppXml.prototype.process = function(xml) {
  try {
     var line = convert.xml2js(xml, this.options);
     return line;
  } catch(e){
     logger.error('error parsing xml',xml);
  }
};

exports.create = function() {
  return new FilterAppXml();
};
