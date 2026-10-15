var vows = require('vows'),
  net = require('net'),
  dgram = require('dgram'),
  assert = require('assert'),
  helper = require('./integration_helper.js');

vows.describe('Integration hep tcp output (#190)').addBatch({
  'sends encapsulated hep over tcp': {
    topic: function() {
      var callback = this.callback;
      var server = net.createServer(function(c) {
        c.once('data', function(buf) {
          c.end();
          server.close(function() {
            agent.close(function() {
              callback(null, buf.length > 10);
            });
          });
        });
      });
      var agent;
      server.listen(45581, '127.0.0.1', function() {
        helper.createAgent([
          'input://udp://127.0.0.1:45582',
          'output://hep://127.0.0.1:45581?protocol=tcp',
        ], function(a) {
          agent = a;
          setTimeout(function() {
            var socket = dgram.createSocket('udp4');
            var payload = new Buffer('{"message":"hep-tcp-test","payload":"ping"}');
            socket.send(payload, 0, payload.length, 45582, '127.0.0.1');
          }, 800);
        });
      });
    },

    'received hep frame': function(err, received) {
      assert.ifError(err);
      assert.equal(received, true);
    }
  },
}).export(module);
