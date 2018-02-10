var base_filter = require('../lib/base_filter'),
  util = require('util'),
  fs = require('fs'),
  logger = require('log4node');

var fastJson = require('fast-json-stringify');
var stringify;

function FilterSchema() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'JSON Schema',
    required_params: ['schema_file'],
    start_hook: this.start,
  });
}

util.inherits(FilterSchema, base_filter.BaseFilter);

FilterSchema.prototype.start = function(callback) {

  if (!this.schema_file) return callback('No Schema File!');
  fs.exists(this.schema_file, function(exists) {
      if (exists) {
        fs.readFile(this.schema_file, function(err, content) {
          if (err) {
            return callback(err);
          }
          try {
	    stringify = fastJson(content);
          }
          catch (e) {
            return callback(new Error('Unable to parse file ' + file_name + ' : ' + e));
          }
	  logger.info('Initialized JSON Schema filter from:',this.schema_file);
          callback();
        }.bind(this));
      }
      else {
        callback('Schema file not found at',this.schema_file);
      }
  }.bind(this));
};

FilterSchema.prototype.process = function(data) {
    return stringify(data);
};

exports.create = function() {
  return new FilterSchema();
};
