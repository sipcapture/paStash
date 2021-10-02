var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

global.Olm = require('olm');
var sdk = require("matrix-js-sdk");

function InputMatrix() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Matrix',
    optional_params: ['path', 'userid', 'token', 'roomid', 'server'],
    default_values: {
      'server': 'https://matrix.org',
      'userId': false,
      'roomId': false,
      'token': false
    },
    start_hook: this.start,
  });
}

util.inherits(InputMatrix, base_input.BaseInput);

InputMatrix.prototype.start = function(callback) {
  logger.info('Start listening on hyperbeam', this.path);
  if (!this.token||!this.userId||!this.roomId) { logger.info('Missing Settings!'); return; }
  try {
	this.matrixClient = sdk.createClient({
	    baseUrl: this.server,
	    accessToken: this.token,
	    userId: this.userId
	}.bind(this));
	matrixClient.initCrypto();
	var viewingRoom = false;
	matrixClient.joinRoom(this.roomId).then(function(room) {
                    this.viewingRoom = room;
		    callback();
                }, function(err) {
                    logger.error("Matrix Join Error: %s", err);
                }.bind(this));

	this.matrixClient.on("sync", function(state, prevState, data) {
	    logger.info("Matrix Sync", state);
	});

	this.matrixClient.on("Room", function(state) {
	    logger.info("Matrix Sync", state);
	});

	this.matrixClient.on("Room.timeline", function(event, room, toStartOfTimeline) {
	    if (toStartOfTimeline) {
	        return; // don't emit paginated results
	    }
	    this.emit('data', { message: event.event, source: 'matrix' });
	}.bind(this));

  } catch(e) { logger.error(e); }
};

InputMatrix.prototype.close = function(callback) {
  logger.info('Closing Matrix input', this.path);
  callback();
};

exports.create = function() {
  return new InputMatrix();
};
