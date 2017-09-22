var base_input = require('../lib/base_input'),
  util = require('util'),
  fs = require('fs'),
  csv = require('csv-parser');
  logger = require('log4node');

function InputCsv() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'CSV',
    mandatory_params: 'file_path',
    optional_params: ['columns','separator', 'quote', 'escape', 'newline'],
    default_params: {
      'separator': ',',
      'quote': '"',
      'escape': '"',
      'newline': '\n',
    },
    start_hook: this.start,
  });
}

util.inherits(InputCsv, base_input.BaseInput);

InputCsv.prototype.start = function(callback) {

  var opts = {
    raw: false,     // do not decode to utf-8 strings
    separator: ',', // specify optional cell separator
    quote: '"',     // specify optional quote character
    escape: '"',    // specify optional escape character (defaults to quote value)
    newline: '\n',  // specify a newline character
  }
  if (!this.columns) opts.headers = this.headers;

  this.socket = fs.createReadStream(this.file_path).pipe(csv(opts));
  
  this.socket.on("error", function (error) {
      logger.info('CSV Parsing Error ' + JSON.stringify(error));
    }).on("headers", function (headers) {
      logger.info('CSV Headers:',headers);
    }).on("data", function (data) {
       this.emit('data', data);
    });
};

InputCsv.prototype.close = function(callback) {
  logger.info('Closing CSV input', this.host);
  this.socket.close();
  callback();
};

exports.create = function() {
  return new InputCsv();
};
