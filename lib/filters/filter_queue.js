var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

function FilterQueue() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Queue',
    optional_params: ['queue_name', 'queue_file'],
    default_values: {
      'queue_file': 'pastash_queue.json',
      'queue_name': 'pqueue',
    },
    start_hook: this.start,
  });
}

util.inherits(FilterQueue, base_filter.BaseFilter);

FilterQueue.prototype.start = function(callback) {
  if (!this.queue_file.endsWith('.json')) { this.queue_file = this.queue_file+'.json'; }
  this.queues = require('queuey')(this.queue_file);
  logger.info('Initializing Queue: '+this.queue_name);
  this.queue = queues.queue({
   name: this.queue_name,
   worker: function (item) {
  	this.emit('data', item);
   }
  }).bind(this);

  logger.info('Initialized Queue Filter');
  callback();
};

FilterQueue.prototype.process = function(data) {
  this.queue.enqueue(data);
};

exports.create = function() {
  return new FilterQueue();
};
