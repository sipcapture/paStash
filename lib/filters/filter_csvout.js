var base_filter = require('../lib/base_filter'),
  util = require('util'),
  csv = require('csv-parser');
  logger = require('log4node');

const { Parser } = require('json2csv');

function FilterCsvOut() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'csv',
    optional_params: ['header','fields','flatten'],
    default_values: {
    	header: false,
    	flatten: true,
        fields: false
    },
    start_hook: this.start
  });
}

util.inherits(FilterCsvOut, base_filter.BaseFilter);

FilterCsv.prototype.start = function(callback) {
  if (this.fields) {
    const json2csvParser = new Parser({ this.fields, header: this.header, flatten: this.flatten });
    callback();
  } else {
    logger.debug('No Fields Defined!');
    return;
  }
}

FilterCsvOut.prototype.process = function(data) {
  if (!data || !data.message ) return;
  var input = data.message || data;
  var out = json2csvParser.parse(input);
  this.emit('output', out);
};

FilterCsvOut.prototype.close = function(callback) {
  logger.info('Closing stdout');
  callback();
};

exports.create = function() {
  return new FilterCsvOut();
};
