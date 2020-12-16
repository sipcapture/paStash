var base_output = require('@pastash/pastash').base_output,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

const Hyperbeam = require('hyperbeam');

function OutputHyperb() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('raw'));
  this.mergeConfig({
    name: 'HyperBeam',
    optional_params: [ 'path' ],
    default_values: {
      'path': false
    },
    start_hook: this.start
  });
}

util.inherits(OutputHyperb, base_output.BaseOutput);

OutputHyperb.prototype.start = function(callback) {
  logger.info('Start listening on hyperbeam', this.path);
  if (!this.path) {
        logger.error('No Beam Key!');
        return;
  }
  this.beam = new Hyperbeam(this.path.toString());

  this.beam.on('remote-address', function ({ host, port }) {
    if (!host) logger.info('[hyperbeam] Could not detect remote address')
    else logger.info('[hyperbeam] Joined the DHT - remote address is ' + host + ':' + port)
    if (port) logger.info('[hyperbeam] Network is holepunchable \\o/')
    callback();
  })

  this.beam.on('connected', function () {
    logger.info('[hyperbeam] Success! Encrypted tunnel established to remote peer')
  })

  // this.beam.on('end', () => this.beam.end())
  this.beam.on('data', function(data){
	logger.info('got',data);
  })

  this.beam.on('error', function(err) {
    logger.error('error', err);
  })

};

OutputHyperb.prototype.process = function(data) {
  if (this.beam) {
	this.beam.write(JSON.stringify(data));
  }
};


OutputHyperb.prototype.close = function(callback) {
  logger.info('Closing hyperbeam output to', this.path);
  if (this.beam) {
	this.beam.destroy()
	this.beam.on('close', function () {
		callback();
  	})
  } else { callback(); }
};

exports.create = function() {
  return new OutputHyperb();
};

