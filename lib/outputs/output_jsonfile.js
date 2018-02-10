var base_output = require('../lib/base_output'),
  util = require('util'),
  logger = require('log4node'),
  jsonfile = require('jsonfile');

function OutputJsonFile() {
  base_output.BaseOutput.call(this);
  this.mergeConfig({
    name: 'JsonFile',
    optional_params: ['path', 'append'],
    default_values: {
      'path': '/tmp/pastash.log',
      'append': true
    },
  });
}

util.inherits(OutputJsonFile, base_output.BaseOutput);

OutputJsonFile.prototype.process = function(data) {
  jsonfile.writeFile(this.path, data, this.append ? {flag:'a'} : {}, function(err){
    logger.warning(err);
  });
};

OutputJsonFile.prototype.close = function(callback) {
  logger.info('Closing JsonFile output to', this.path);
  this.closed = true;
  callback();
};

exports.create = function() {
  return new OutputJsonFile();
};
