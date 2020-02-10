var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  fs = require('fs'),
  csv = require('csv-parser');
  logger = require('@pastash/pastash').logger;

function InputCsv() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'CSV',
    optional_params: ['headers', 'separator', 'quote', 'escape', 'newline', 'file_path'],
    start_hook: this.start
  });
}

util.inherits(InputCsv, base_input.BaseInput);

InputCsv.prototype.start = function(callback) {
  if (!this.file_path) { logger.error('Missing File name/path!'); return; }

  var opts = { raw: false };
  if (this.headers) opts.headers = this.headers;
  if (this.separator) opts.separator = this.separator;
  if (this.quote) opts.quote = this.quote;
  if (this.escape) opts.escape = this.escape;
  if (this.newline) opts.newline = this.newline;

  this.csv = csv(opts)
    .on("error", function (error) {
      	logger.info('CSV Parsing Error ' + JSON.stringify(error));
    }).on("headers", function (headers) {
      	logger.debug('CSV Headers:',headers);
    }).on("end", function () {
      	logger.info('CSV Completed!');
    }).on("data", function (data) {
         this.emit('data', data);
    }.bind(this));

    fs.createReadStream(this.file_path).pipe(this.csv);
    callback();
};

InputCsv.prototype.close = function(callback) {
  logger.info('Closing CSV input', this.host);
  callback();
};

exports.create = function() {
  return new InputCsv();
};
