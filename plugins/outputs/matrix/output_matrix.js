var base_output = require('@pastash/pastash').base_output,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

function OutputMatrix() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('raw'));
  this.mergeConfig({
    name: 'Matrix',
    optional_params: ['path', 'userid', 'token', 'roomid', 'server', 'olm', 'debug'],
    default_values: {
      'server': 'https://matrix.org',
      'userId': false,
      'roomId': false,
      'token': false,
      'olm': false,
      'debug': false
    },    start_hook: this.start
  });
}

util.inherits(OutputMatrix, base_output.BaseOutput);

OutputMatrix.prototype.start = function(callback) {
  logger.info('Start listening on matrix', this.roomId);
  if (!this.token||!this.userId||!this.roomId) { logger.info('Missing Settings!'); return; }

  if (this.olm) global.Olm = require('olm');
  var sdk = require("matrix-js-sdk");

  try {
        this.matrixClient = sdk.createClient({
            baseUrl: this.server,
            accessToken: this.token,
            userId: this.userId
        }.bind(this));
        if (this.olm) matrixClient.initCrypto();
        this.viewingRoom = false;
        this.matrixClient.joinRoom(this.roomId).then(function(room) {
                    this.viewingRoom = room;
		    logger.info("Connected to room", this.roomId, room.roomId);
                    callback();
                }.bind(this), function(err) {
                    logger.error("Matrix Join Error: %s", err);
                });

        this.matrixClient.on("sync", function(state, prevState, data) {
            if (this.debug) logger.info("Matrix Sync", state);
        });

        this.matrixClient.on("Room", function(state) {
            if (this.debug) logger.info("Matrix Sync", state);
        });

        this.matrixClient.on("Room.timeline", function(event, room, toStartOfTimeline) {
            if (toStartOfTimeline) {
                return; // don't emit paginated results
            }
	    if (this.debug) logger.info("Received", event.event);
        }.bind(this));

	this.matrixClient.startClient(0);

  } catch(e) { logger.error(e); }



};

OutputMatrix.prototype.process = function(data) {
  if (this.viewingRoom) {
    this.matrixClient.sendTextMessage(this.viewingRoom.roomId, data).finally(function() {
	if (this.debug) logger.info("sent message", data);
    });
  }
};


OutputMatrix.prototype.close = function(callback) {
  logger.info('Closing Matrix output', this.roomId);
  callback();
};

exports.create = function() {
  return new OutputMatrix();
};

