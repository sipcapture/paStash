var vows = require('vows'),
  dgram = require('dgram'),
  assert = require('assert'),
  helper = require('./integration_helper.js');

vows.describe('Integration udp hep relay (#111)').addBatch({
  'forwards binary udp payload unchanged': {
    topic: function() {
      var callback = this.callback;
      var hep = Buffer.from([0x48, 0x45, 0x50, 0x03, 0x00, 0x00, 0x00, 0x10]);
      var received = null;
      var sink = dgram.createSocket('udp4');
      sink.on('message', function(msg) {
        received = msg;
      });
      sink.bind(45590, '127.0.0.1', function() {
        helper.createAgent([
          'input://udp://127.0.0.1:45591?unserializer=raw',
          'output://udp://127.0.0.1:45590?serializer=raw&format=%23%7Bmessage%7D',
        ], function(agent) {
          var src = dgram.createSocket('udp4');
          src.send(hep, 0, hep.length, 45591, '127.0.0.1', function() {
            setTimeout(function() {
              agent.close(function() {
                sink.close(function() {
                  callback(null, received);
                });
              });
            }, 300);
          });
        });
      });
    },

    'payload matches': function(err, received) {
      assert.ifError(err);
      assert.ok(received);
      assert.equal(received[0], 0x48);
      assert.equal(received[1], 0x45);
      assert.equal(received[2], 0x50);
      assert.equal(received[3], 0x03);
    }
  },
}).export(module);
