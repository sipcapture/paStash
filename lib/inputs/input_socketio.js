var base_input = require('../lib/base_input'),
  util = require('util'),
  http = require('http'),
  https = require('https'),
  io = require('socket.io')(),
  //SocketIOServer = require('ws').Server,
  ssl_helper = require('../lib/ssl_helper'),
  logger = require('log4node');

function InputSocketIO() {
  base_input.BaseInput.call(this);
  this.mergeConfig(ssl_helper.config());
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'SocketIO',
    host_field: 'host',
    port_field: 'port',
    optional_params: ['type', 'path'],
    default_values: {
      'path': '/'
    },
    start_hook: this.start
  });
}
util.inherits(InputSocketIO, base_input.BaseInput);

InputSocketIO.prototype.start = function(callback) {
    this.io_listener = function(chunk) {
         this.emit('data', {
             'message': chunk ,
             'host': this.host ,
             'ws_port': this.port,
             'type': this.type
         });
     }.bind(this);

    logger.info('Start listening on socket.io ', this.host + ':' + this.port, 'ssl ' + this.ssl);

    if (this.ssl) {
        this.server = https.createServer(ssl_helper.merge_options(this, {}));
        this.server.on('clientError', function(err) {
          this.emit('error', err);
        }.bind(this));
    }
    else {
       this.server = http.createServer();
    }
    io.attach(this.server,
        {
            pingInterval: 10000,
            pingTimeout: 5000,
            cookie: false
        });
    io.on('connection', function (socket){
        socket.on('Log', function (data) {
             this.io_listener(data);
            }.bind(this));
        }.bind(this));
    this.server.listen(this.port, this.host);
    callback();
};

InputSocketIO.prototype.close = function(callback) {
  logger.info('Closing SOCKETIO server', this.host + ':' + this.port, 'ssl ' + this.ssl);
  // close the server and terminate all clients

  this.server.close(function() {
    callback();
  });
};

exports.create = function() {
  return new InputSocketIO();
};
