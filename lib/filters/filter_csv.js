var base_filter = require('../lib/base_filter'),
  util = require('util'),
  csv = require('csv-parser');
  logger = require('log4node');

function FilterCsv() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'csv',
    optional_params: ['headers', 'separator', 'quote', 'escape', 'newline'],
    start_hook: this.start
  });
}

util.inherits(FilterCsv, base_filter.BaseFilter);

FilterCsv.prototype.start = function(callback) {

  var opts = { raw: false };
  if (this.headers) opts.headers = this.headers;
  if (this.separator) opts.separator = this.separator;
  if (this.quote) opts.quote = this.quote;
  if (this.escape) opts.escape = this.escape;
  if (this.newline) opts.newline = this.newline;

  this.parser = csv(opts)
    .on("error", function (error) {
      	logger.info('CSV Parsing Error ' + JSON.stringify(error));
    }).on("headers", function (headers) {
      	logger.debug('CSV Headers:',headers);
    }).on("end", function () {
      	logger.info('CSV Completed!');
    }).on("data", function (data) {
      	logger.debug('CSV Data!',data);
        this.emit('output', data);
    }.bind(this));

  callback();
};

FilterCsv.prototype.process = function(data){
	if (!data || !data.message ) return;
	this.parser.write( Buffer.from(data.message+'\n', 'utf8') );
};


FilterCsv.prototype.close = function(callback) {
  logger.info('Closing CSV input', this.host);
  callback();
};

exports.create = function() {
  return new FilterCsv();
};
