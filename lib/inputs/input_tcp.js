var base_input = require('../lib/base_input'),
  net = require('net'),
  tls = require('tls'),
  util = require('util'),
  ssl_helper = require('../lib/ssl_helper'),
  async = require('async'),
  async_helper = require('../lib/async_helper'),
  logger = require('log4node');

function InputTcp() {
  base_input.BaseInput.call(this);
  this.mergeConfig(ssl_helper.config());
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Tcp',
    host_field: 'host',
    port_field: 'port',
    optional_params: ['type', 'appendPeerCert', 'line_delimiter'],
    default_values: {
      'appendPeerCert': true,
    },
    start_hook: this.start,
    config_hook: this.configureLineDelimiter,
  });
}

util.inherits(InputTcp, base_input.BaseInput);

InputTcp.prototype.configureLineDelimiter = function(callback) {
  if (this.line_delimiter === undefined && this.unserializer === 'raw') {
    this.line_delimiter = '\n';
  }
  callback();
};

InputTcp.prototype.emitRawMessage = function(c, message) {
  var obj = {
    'message': message,
    'host': c.remoteAddress,
    'source': c.remoteAddress + ':' + c.remotePort,
    'tcp_port': this.port,
    'type': this.type,
  };
  if (this.ssl && this.appendPeerCert) {
    var peer_cert = c.getPeerCertificate();
    obj.tls = {
      'authorized': c.authorized,
      'peer_cert': {
        'subject': peer_cert.subject,
        'issuer': peer_cert.issuer,
        'valid_from': peer_cert.valid_from,
        'valid_to': peer_cert.valid_to,
        'fingerprint': peer_cert.fingerprint,
      }
    };
  }
  this.emit('data', obj);
};

InputTcp.prototype.processIncomingData = function(c, data) {
  this.unserialize_data(data, function(parsed) {
    this.emit('data', parsed);
  }.bind(this), function(raw) {
    if (this.line_delimiter) {
      if (!c._line_buffer) {
        c._line_buffer = '';
      }
      c._line_buffer += raw.toString();
      var parts = c._line_buffer.split(this.line_delimiter);
      c._line_buffer = parts.pop();
      for (var i = 0; i < parts.length; i++) {
        var line = parts[i];
        if (line.length > 0 && line.charCodeAt(line.length - 1) === 13) {
          line = line.slice(0, -1);
        }
        this.emitRawMessage(c, line);
      }
      return;
    }
    this.emitRawMessage(c, raw.toString().trim());
  }.bind(this));
};

InputTcp.prototype.start = function(callback) {
  logger.info('Start listening on tcp', this.host + ':' + this.port);
  this.counter = 0;
  this.current = {};

  var listener = function(c) {
    var local_id = this.counter;
    this.counter += 1;
    this.current[local_id] = c;
    c.on('data', function(data) {
      this.processIncomingData(c, data);
    }.bind(this));
    c.on('error', function(err) {
      this.emit('error', err);
    }.bind(this));
    c.on('close', function() {
      if (c._line_buffer && c._line_buffer.length > 0) {
        this.emitRawMessage(c, c._line_buffer);
        c._line_buffer = '';
      }
      delete this.current[local_id];
    }.bind(this));
  }.bind(this);

  if (this.ssl) {
    this.server = tls.createServer(ssl_helper.merge_options(this, {}), listener);
    this.server.on('clientError', function(err) {
      this.emit('error', err);
    }.bind(this));
  }
  else {
    this.server = net.createServer(listener);
  }

  this.server.on('error', function(err) {
    this.emit('error', err);
  }.bind(this));

  this.server.listen(this.port, this.host);

  this.server.once('listening', callback);
};

InputTcp.prototype.close = function(callback) {
  logger.info('Closing listening tcp', this.host + ':' + this.port);
  async.eachSeries(Object.keys(this.current), function(x, callback) {
    var c = this.current[x];
    c.once('close', callback);
    c.end();
  }.bind(this), async_helper.chainedCloseAll([this.server], callback));
};

exports.create = function() {
  return new InputTcp();
};
