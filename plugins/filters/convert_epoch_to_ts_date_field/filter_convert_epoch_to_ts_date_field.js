/*
   Epoch to human readable timestamp filter for PaStash
   (C) 2020 Fuze Canada Inc.
*/
var base_filter = require('../lib/base_filter'),
  util = require('util'),
  moment = require('moment'),
  logger = require('log4node');

function FilterConvertEpochToTsDateField() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'ConvertEpochToTsDateField',
    required_params: ['date_format'],
    host_field: 'field',
    start_hook: this.start,
  });
}

util.inherits(FilterConvertEpochToTsDateField, base_filter.BaseFilter);

FilterConvertEpochToTsDateField.prototype.start = function(callback) {
  logger.info('Initialized Epoch to TS convertion date field filter on field: ' + this.field + ', date_format: ' + this.date_format);
  callback();
};

FilterConvertEpochToTsDateField.prototype.process = function(data) {
  var value = data[this.field];
  if (value) {
    data[this.field] = moment(value).format(this.date_format);
  }
  return data;
};

exports.create = function() {
  return new FilterConvertEpochToTsDateField();
};
