var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var EventSource = require('eventsource');

function InputNtfy() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Ntfy',
    optional_params: ['url', 'debug'],
    default_values: {
      'url': 'https://ntfy.org',
      'debug': false
    },
    start_hook: this.start,
  });
}

util.inherits(InputNtfy, base_input.BaseInput);

InputNtfy.prototype.start = function(callback) {
  logger.info('Start listening on ntfy', this.url);
  const eventSource = new EventSource(this.url);
  eventSource.onmessage = (event) => {
    if (this.debug) logger.info(event);
    this.emit('data', { message: event.data, source: 'ntfy' });
  };
  callback();
};

InputNtfy.prototype.close = function(callback) {
  logger.info('Closing ntfy input', this.url);
  callback();
};

exports.create = function() {
  return new InputNtfy();
};
