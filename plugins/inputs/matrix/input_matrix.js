var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

function InputMatrix() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Matrix',
    optional_params: ['userId', 'token', 'roomId', 'server', 'olm', 'debug'],
    default_values: {
      'server': 'https://matrix.org',
      'userId': false,
      'roomId': false,
      'token': false,
      'olm': false,
      'debug': false
    },
    start_hook: this.start,
  });
}

util.inherits(InputMatrix, base_input.BaseInput);

InputMatrix.prototype.start = function(callback) {
  logger.info('Start listening on matrix', this.roomId);

  if (this.olm) global.Olm = require('olm');
  var sdk = require("matrix-js-sdk");

  if (!this.token||!this.userId||!this.roomId) { logger.info('Missing Settings!'); return; }
  try {
	var matrixClient = sdk.createClient({
	    baseUrl: this.server,
	    accessToken: this.token,
	    userId: this.userId
	});
	if (this.olm) this.matrixClient.initCrypto();
	this.viewingRoom = false;
	matrixClient.joinRoom(this.roomId).then(function(room) {
                    this.viewingRoom = room;
		    callback();

                }.bind(this), function(err) {
                    logger.error("Matrix Join Error: %s", err);
		    return;
                });

	matrixClient.on("sync", function(state, prevState, data) {
	        if (this.debug) logger.info("Matrix Sync", state);
	}.bind(this));

	matrixClient.on("Room", function(state) {
	        if (this.debug) logger.info("Matrix Sync", state);
	}.bind(this));

	matrixClient.on("Room.timeline", function(event, room, toStartOfTimeline) {
	        this.emit('data', { message: event.event, source: 'matrix' });
	}.bind(this));

	matrixClient.startClient(0);

  } catch(e) { logger.error(e); }
};

InputMatrix.prototype.close = function(callback) {
  logger.info('Closing Matrix input', this.path);
  callback();
};

exports.create = function() {
  return new InputMatrix();
};
