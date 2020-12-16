var base_output = require('@pastash/pastash').base_output,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

const Hyperbeam = require('hyperbeam');

function OutputHyperb() {
  this.mergeConfig(this.serializer_config('raw'));
  this.mergeConfig(error_buffer.config(function() {
    return 'output hyperbeam to ' + this.path;
  }));
  this.mergeConfig({
    name: 'HyperBeam',
    optional_params: ['path'],
    default_values: {
      'path': false,
    },
  });
}

util.inherits(OutputHyperb, base_output.BaseOutput);

OutputHyperb.prototype.process = function(data) {
  this.beam.push(data);
};

OutputHyperb.prototype.start = function(callback) {
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

  this.beam.on('error', function(err) {
    this.emit('error', err);
  }.bind(this));

  callback();
};

OutputHyperb.prototype.close = function(callback) {
  logger.info('Closing hyperbeam output to', this.path);
  beam.destroy()
  beam.on('close', function () {
    callback();
  })
};

exports.create = function() {
  return new OutputHyperb();
};

