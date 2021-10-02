/*
   Dry rendering for @pastash/pastash
   (C) 2021 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

const { render } = require('dry');

function FilterAppDry() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppDry',
    optional_params: ['debug', 'render', 'target'],
    default_values: {
      'debug': false,
      'target': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppDry, base_filter.BaseFilter);

FilterAppDry.prototype.start = function(callback) {
  logger.info('Initialized Dry template');
  callback();
};

FilterAppDry.prototype.process = async function(data) {
  try {

     if (!this.render) return data;

     var line = await render(this.render, object );
     if (this.target) data[this.target] = line;
     else data.message = line;

     return data;

  } catch(e){
     logger.error('error rendering dry',this.render, data);
  }
};

exports.create = function() {
  return new FilterAppDry();
};
