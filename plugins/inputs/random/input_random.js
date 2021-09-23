var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var faker = require('faker');

function InputRandom() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Random',
    optional_params: ['type', 'every'],
    default_values: {
      'type': 'json',
      'every': 1000,
      'debug': false,
    },
    start_hook: this.start,
  });
}

util.inherits(InputRandom, base_input.BaseInput);

InputRandom.prototype.start = function(callback) {
  logger.info('Start Random Input', this.every);
  this.timer = setInterval(function(){
	if (this.type == 'json') this.emit('data', faker.datatype.json());
	else if (this.type == 'git') this.emit('data', faker.datatype.git.CommitMessage());
  }, this.every);

};

InputRandom.prototype.close = function(callback) {
  logger.info('Closing random input', this.path);
  clearInterval(this.timer);
  callback();
};

exports.create = function() {
  return new InputRandom();
};
