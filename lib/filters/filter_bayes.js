/* PaStash BAYES Filter
 * (c) 2018 QXIP BV
 * see LICENSE for License Details
 */

var base_filter = require('../lib/base_filter');
var  util = require('util'),
  logger = require('log4node');

var bayes_helper = require('../lib/bayes_helper');

function FilterBayes() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig(bayes_helper.config());
  this.mergeConfig({
    name: 'Bayes',
    required_params: ['json_file', 'source_field'],
    optional_params: ['target_field'],
    default_values: {
      'target_field': 'bayes'
    },
    start_hook: this.start,
  });
}

util.inherits(FilterBayes, base_filter.BaseFilter);

FilterBayes.prototype.start = function(callback) {
  this.classifier = bayes;
  if(this.json_file) this.classifier_load(this.json_file);
  callback();
};

FilterBayes.prototype.process = function(data) {
  try {
	var xdata = data.message || data;
	if (xdata[this.source_field]){
	  var class = this.classifier.categorize( xdata[this.source_field] );
	  if (class) xdata[this.target_field] = class;
	}
        this.emit('output',xdata);

  } catch(e) { return data; }

};

exports.create = function() {
  return new FilterBayes();
};
