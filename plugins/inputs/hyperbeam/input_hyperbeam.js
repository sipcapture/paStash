var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

const Hyperbeam = require('hyperbeam')

function InputHyperb() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'HyperBeam',
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
  if (!this.path) { logger.info('No Beam Key!'); return; }
  try {
  this.beam = new Hyperbeam(this.path)
  this.beam.on('remote-address', function ({ host, port }) {
    if (!host) logger.info('[hyperbeam] Could not detect remote address')
    else logger.info('[hyperbeam] Joined the DHT - remote address is ' + host + ':' + port)
    if (port) logger.info('[hyperbeam] Network is holepunchable \\o/')
    callback()
  })

  this.beam.on('connected', function () {
    logger.info('[hyperbeam] Success! Encrypted tunnel established to remote peer')
  })

  // this.beam.on('end', () => this.beam.end())
  this.beam.on('end', function(){
	logger.info('stream ended');
  	this.beam.destroy();
	this.close_modules(process.exit(0));
  }.bind(this))

  this.beam.on('data', function(chunk) {
    this.emit( 'data', { message: chunk.toString(), source: 'hyper' } );
  }.bind(this));

  this.beam.on('error', function(err) {
    this.emit('error', err);
  }.bind(this))

  } catch(e) { logger.error(e); }
};

InputHyperb.prototype.close = function(callback) {
  logger.info('Closing hyperbeam input', this.path);
  callback();
};

exports.create = function() {
  return new InputHyperb();
};
