var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

const Hyperbeam = require('hyperbeam')

function InputHyperb() {
  base_input.BaseInput.call(this);
  this.mergeConfig(ssl_helper.config());
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'HyperBeam',
    host_field: 'host',
    port_field: 'port',
    optional_params: ['path'],
    default_values: {
      'path': false,
    },
    start_hook: this.start,
  });
}

util.inherits(InputHyperb, base_input.BaseInput);

InputHyperb.prototype.start = function(callback) {
  logger.info('Start listening on hyperbeam', this.path);
  if (!this.path) {
	console.error('No Beam Key!');
	return;
  }

  this.beam = new Hyperbeam(this.path)

  this.beam.on('remote-address', function ({ host, port }) {
    if (!host) console.error('[hyperbeam] Could not detect remote address')
    else console.error('[hyperbeam] Joined the DHT - remote address is ' + host + ':' + port)
    if (port) console.error('[hyperbeam] Network is holepunchable \\o/')
  })

  this.beam.on('connected', function () {
    console.error('[hyperbeam] Success! Encrypted tunnel established to remote peer')
  })

  this.beam.on('end', () => beam.end())

  this.beam.on('data', function(data) {
	this.emit(data);
  }.bind(this));

  this.beam.on('error', function(err) {
    this.emit('error', err);
  }.bind(this));

};

InputHyperb.prototype.close = function(callback) {
  logger.info('Closing hyperbeam', this.path);
  beam.destroy()
  beam.on('close', function () {
    callback();
  })

};

exports.create = function() {
  return new InputHyperb();
};
