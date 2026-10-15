var vows = require('vows-batch-retry'),
  net = require('net'),
  fs = require('fs'),
  assert = require('assert'),
  helper = require('./integration_helper.js');

vows.describe('Integration tcp line framing (#51)').addBatchRetry({
  'reassembles syslog-style lines and preserves leading spaces': {
    topic: function() {
      var callback = this.callback;
      helper.createAgent([
        'input://tcp://127.0.0.1:45580?unserializer=raw',
        'output://file://output_tcp_framing.txt?serializer=json_logstash',
      ], function(agent) {
        var client = net.connect({host: '127.0.0.1', port: 45580});
        client.on('connect', function() {
          client.write('<30>line one\n<30>line two\n     indented\n');
          client.end();
          setTimeout(function() {
            agent.close(function() {
              callback(null);
            });
          }, 300);
        });
      });
    },

    check: function(err) {
      assert.ifError(err);
      var lines = fs.readFileSync('output_tcp_framing.txt').toString().split('\n').filter(function(l) {
        return l.length > 0;
      });
      fs.unlinkSync('output_tcp_framing.txt');
      assert.equal(lines.length, 3);
      assert.equal(JSON.parse(lines[0]).message, '<30>line one');
      assert.equal(JSON.parse(lines[1]).message, '<30>line two');
      assert.equal(JSON.parse(lines[2]).message, '     indented');
    }
  },
}, 5, 20000).export(module);
