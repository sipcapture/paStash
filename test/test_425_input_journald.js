var vows = require('vows'),
  fs = require('fs'),
  path = require('path'),
  assert = require('assert'),
  helper = require('./integration_helper.js');

var fakeJournalctl = path.join(__dirname, 'fixtures', 'fake_journalctl.sh');

vows.describe('Integration journald input (#102)').addBatch({
  'parses journalctl json lines': {
    topic: function() {
      var callback = this.callback;
      helper.createAgent([
        'input://journald://?journalctl=' + fakeJournalctl + '&follow=false&lines=1',
        'output://file://output_journald.txt?serializer=json_logstash',
      ], function(agent) {
        setTimeout(function() {
          agent.close(function() {
            callback(null);
          });
        }, 400);
      });
    },

    'emits parsed journal fields': function(err) {
      assert.ifError(err);
      var body = fs.readFileSync('output_journald.txt').toString();
      fs.unlinkSync('output_journald.txt');
      var line = body.split('\n').filter(function(l) { return l.length > 0; })[0];
      var parsed = JSON.parse(line);
      assert.equal(parsed.message, 'journald test line');
      assert.equal(parsed.PRIORITY, '6');
      assert.equal(parsed.source, 'journald');
    }
  },
}).export(module);
