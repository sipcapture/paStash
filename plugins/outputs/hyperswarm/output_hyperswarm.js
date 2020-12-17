var base_output = require('@pastash/pastash').base_output,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

const hyperswarm = require('hyperswarm')
const crypto = require('crypto')

function OutputHyperSwarm() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('raw'));
  this.mergeConfig({
    name: 'HyperSwarm',
    optional_params: [ 'path' ],
    default_values: {
      'path': false
    },
    start_hook: this.start
  });
}

util.inherits(OutputHyperSwarm, base_output.BaseOutput);

OutputHyperSwarm.prototype.start = function(callback) {
  logger.info('Start listening on hyperswarm', this.path);
  if (!this.path) { logger.info('No Beam Key!'); return; }
  try {
        this.swarm = hyperswarm();
        this.topic = crypto.createHash('sha256')
          .update(this.path)
          .digest()

        this.swarm.join(this.topic, {
          lookup: true, // find & connect to peers
          announce: true // optional- announce self as a connection target
        })

        this.swarm.on('connection', (socket, details) => {
          console.log('new connection!', details)
	  this.socket = socket;
        }.bind(this))

        callback();

  } catch(e) { logger.error(e); }

};

OutputHyperSwarm.prototype.process = function(data) {
  if (this.socket) {
	this.socket.write(JSON.stringify(data));
  }
};


OutputHyperSwarm.prototype.close = function(callback) {
  logger.info('Closing hyperswarm output to', this.path);
  swarm.leave(this.path, callback())
};

exports.create = function() {
  return new OutputHyperSwarm();
};

