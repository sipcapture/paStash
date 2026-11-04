var vows = require('vows'),
  assert = require('assert'),
  mysql = require('../plugins/outputs/mysql/node_modules/mysql2'),
  bind_query = require('../plugins/outputs/mysql/bind_query');

var LEGACY = "call SP_UpdateSyncResult('{|data|}');";
var attack = { message: "foo'), (SELECT SLEEP(5)) --" };

function payloadOf(data) {
  return JSON.stringify(data, null, 2);
}

function formatted(query, data) {
  var payload = payloadOf(data);
  var bound = bind_query.bindEventQuery(query, payload);
  return {
    bound: bound,
    sql: mysql.format(bound.sql, bound.params)
  };
}

vows.describe('MySQL output bind ').addBatch({
  'legacy quoted placeholder is a bound parameter': function() {
    var payload = payloadOf(attack);
    var result = formatted(LEGACY, attack);
    assert.equal(result.bound.sql, 'call SP_UpdateSyncResult(?);');
    assert.deepEqual(result.bound.params, [payload]);
    assert.equal(result.sql, 'call SP_UpdateSyncResult(' + mysql.escape(payload) + ');');
    assert.equal(result.sql.indexOf("foo'), (SELECT SLEEP(5))"), -1);
  },
  'default query binds the event': function() {
    var payload = payloadOf(attack);
    var result = formatted(bind_query.DEFAULT_QUERY, attack);
    assert.equal(result.bound.sql, bind_query.DEFAULT_QUERY);
    assert.deepEqual(result.bound.params, [payload]);
    assert.equal(result.sql.indexOf("foo'), (SELECT SLEEP(5))"), -1);
  },
  'bare placeholder and a literal question mark': function() {
    var payload = payloadOf({ message: "a'b" });
    var bound = bind_query.bindEventQuery("SELECT '?', {|data|}", payload);
    assert.equal(bound.sql, "SELECT '?', ?");
    assert.deepEqual(bound.params, [payload]);
  },
  'each placeholder gets its own parameter': function() {
    var payload = payloadOf({ message: 'x' });
    var bound = bind_query.bindEventQuery('INSERT INTO t VALUES ({|data|}, "{|data|}")', payload);
    assert.equal(bound.sql, 'INSERT INTO t VALUES (?, ?)');
    assert.deepEqual(bound.params, [payload, payload]);
  },
  'statement without a placeholder is not given one': function() {
    var bound = bind_query.bindEventQuery('SELECT 1', payloadOf({ message: 'x' }));
    assert.equal(bound.sql, 'SELECT 1');
    assert.deepEqual(bound.params, []);
  }
}).export(module);
