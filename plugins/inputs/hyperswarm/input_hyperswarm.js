var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

const hyperswarm = require('hyperswarm')
const crypto = require('crypto')

function InputHyperSwarm() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'hyperswarm',
    optional_params: ['path'],
    default_values: {
      'path': false,
    },
    start_hook: this.start,
  });
}

util.inherits(InputHyperSwarm, base_input.BaseInput);

InputHyperSwarm.prototype.start = function(callback) {
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
  	  // you can now use the socket as a stream, eg:
  	  // process.stdin.pipe(socket).pipe(process.stdout)
	  socket.on('data', function(data){
		this.emit('data',data);
	  }.bind(this))
  	}.bind(this))

	callback();

  } catch(e) { logger.error(e); }
};

InputHyperSwarm.prototype.close = function(callback) {
  logger.info('Closing hyperswarm input', this.path);
  swarm.leave(this.path, callback())
};

exports.create = function() {
  return new InputHyperSwarm();
};
