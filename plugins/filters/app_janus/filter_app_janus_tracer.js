/* Janus Event Tracer (C) 2022 QXIP BV */

/* eslint-disable camelcase */
/* eslint-disable semi */
/* eslint quotes: 0 */
/* eslint-disable quote-props */
/* eslint-disable dot-notation */

var base_filter = require('@pastash/pastash').base_filter
var util = require('util')
var logger = require('@pastash/pastash').logger

const QuickLRU = require("quick-lru");

const recordCache = require("record-cache");
const fetch = require('cross-fetch');

const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { MeterProvider } = require('@opentelemetry/sdk-metrics-base');

function nano_now (date) { return parseInt(date.toString().padEnd(16, '0')) }
function just_now (date) { return nano_now(date || new Date().getTime()) }
function spanid () { return Math.floor(10000000 + Math.random() * 90000000).toString() }

function FilterAppJanusTracer () {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppJanusTracer',
    optional_params: ['debug', 'cacheSize', 'cacheAge', 'endpoint', 'bypass', 'port', 'metrics', 'service_name', 'interval'],
    default_values: {
      'cacheSize': 50000,
      'cacheAge': 60000,
      'endpoint': 'http://localhost:3100/tempo/api/push',
      'metrics': false,
      'service_name': 'pastash-janus',
      'interval': 10000,
      'port': 9090,
      'bypass': true,
      'debug': false
    },
    start_hook: this.start.bind(this)
  });
}

util.inherits(FilterAppJanusTracer, base_filter.BaseFilter);

FilterAppJanusTracer.prototype.start = async function (callback) {
  // Event cache
  var cache = recordCache({
    maxSize: this.cacheSize,
    maxAge: this.cacheAge,
    onStale: false
  });
  this.cache = cache;

  // Session cache
  var sessions = recordCache({
    maxSize: this.cacheSize,
    maxAge: this.cacheAge,
    onStale: false
  });
  this.sessions = sessions;
  this.lru = new QuickLRU({ maxSize: 10000, maxAge: 3600000, onEviction: false });

  if (this.metrics) {
    // Initialize Service
    const options = { port: this.port, startServer: true };
    const exporter = new PrometheusExporter(options);

    // Register the exporter
    this.meter = new MeterProvider({
      exporter,
      interval: this.interval
    }).getMeter(this.service_name)
    this.counters = {};

    // Register counters
    this.counters['s'] = this.meter.createUpDownCounter('sessions', {
      description: 'Session Counters'
    });
    this.counters['e'] = this.meter.createUpDownCounter('events', {
      description: 'Event Counters'
    });

    logger.info('Initialized Janus Prometheus Exporter :' + this.port + '/metrics');
  }
  logger.info('Initialized App Janus Span Tracer with: ' + this.endpoint);
  callback();
};

FilterAppJanusTracer.prototype.process = function (data) {
  // bypass
  if (this.bypass) this.emit('output', data)
  if (!data.message) return;
  var event = {};
  var line = JSON.parse(data.message);
  logger.info('Incoming line', line.type, line.event)
  /* Ignore all other events */
  if (line.type === 128 || line.type === 8 || line.type === 16 || line.type === 32) return;
  logger.info('Filtered to 1, 2, 64', line.type, line.session_id, line.handle_id)
  event = {
    name: line.event.name,
    event: line.event.data.event || line.event.name,
    session_id: line.session_id || line.event.data.id,
    id: line.event.data.id || line.session_id,
    spanId: spanid(),
    timestamp: line.timestamp || nano_now(new Date().getTime())
  }
  /*
  TYPE 1

  Create Session and Destroy Session events are tracked
  */
  if (line.type === 1) {
    event.traceId = event.session_id
    event.duration = 1000
    /* CREATE event */
    if (event.name === "created") {
      // create root span
      this.lru.set(event.session_id, event);
      // start root trace, do not update
      this.sessions.add(event.session_id, just_now(event.timestamp));
      this.sessions.add('uuid_' + event.session_id, event.traceId)
      this.sessions.add('span_' + event.session_id, event.spanId)
      this.sessions.add('parent_' + event.session_id, event.spanId)
      if (this.metrics) this.counters['s'].add(1, line.event);
    /* DESTROY event */
    } else if (event.name === "destroyed") {
      const previous_ts = this.sessions.get(event.session_id, 1)[0] || nano_now(new Date().getTime());
      event.duration = just_now(event.timestamp) - parseInt(previous_ts);
      /* name the event Session */
      event.name = "Session " + event.session_id
      // delete root span
      this.lru.delete(event.session_id);
      // end root trace
      this.sessions.remove(event.session_id);
      this.sessions.remove('uuid_' + event.session_id);
      if (this.metrics) this.counters['s'].add(-1, line.event);
    }

    tracegen(event, this.endpoint)
  /*
  TYPE 2

  Client Attachment and Detachment is tracked
  */
  } else if (line.type === 2) {
    if (!line.event.data) return;
    // session tracing + reset
    event.traceId = this.sessions.get('uuid_' + event.session_id, 1)[0] || line.session_id;
    event.spanId = this.sessions.get('span_' + event.session_id, 1)[0] || spanid();
    var previous_ts = this.sessions.get(event.session_id, 1)[0] || nano_now(new Date().getTime());
    event.duration = just_now(line.timestamp) - parseInt(previous_ts);
    this.sessions.add(event.session_id, just_now(line.timestamp));

    if (event.name === "attached") {
      // session_id, handle_id, opaque_id
    } else if (event.name === "detached") {
      // session_id, handle_id, opaque_id
      this.sessions.remove(event.handle_id);
    }
    event.parentId = this.sessions.get(event.session_id, 1)[0]

    tracegen(event, this.endpoint)
  /*
  TYPE 64

  Users Joining or Leaving Sessions
  */
  } else if (line.type === 64) {
    if (!line.event.data) return;
    // session tracing + reset
    event.traceId = this.sessions.get('uuid_' + event.session_id, 1)[0] || line.session_id;
    event.spanId = this.sessions.get('span_' + event.session_id, 1)[0] || spanid();
    const previous_ts = this.sessions.get(event.session_id, 1)[0] || nano_now(new Date().getTime());
    event.duration = just_now(event.timestamp) - parseInt(previous_ts);
    this.sessions.add(event.session_id, just_now(line.timestamp));

    logger.info("trace 64: ", line)
    if (event.event === "joined") {
      // session_id, handle_id, opaque_id, event.data.id
      // correlate: session_id --> event.data.id
      this.cache.add(event.id, event.session_id);
      this.lru.set(event.id, event.session_id);
      // increase tag counter
      if (this.metrics) this.counters['e'].add(1, line.event.data);
    } else if (event.event === "configured") {
      // session_id, handle_id, opaque_id, event.data.id
    } else if (event.event === "published") {
      // session_id, handle_id, opaque_id, event.data.id
      this.cache.add(event.id, event.session_id);
      this.lru.set(event.id, event.session_id);
    } else if (event.event === "unpublished") {
      // correlate: event.data.id --> session_id
      // event.session_id = this.cache.get(event.id, 1)[0] || false;
      event.session_id = this.lru.get(event.id) || false;
      line.session_id = event.session_id;
    } else if (event.event === "leaving") {
      // correlate: event.data.id --> session_id
      logger.info("missing session id", event.id)
      // event.session_id = this.cache.get(event.id, 1)[0] || false;
      event.session_id = this.lru.get(event.id) || false;
      logger.info("fetched event id", event.session_id)
      line.session_id = event.session_id;
      this.cache.remove(event.id, event.session_id)
      // decrease tag counter
      if (this.metrics) this.counters['e'].add(-1, line.event.data);
    }
    event.parentId = this.sessions.get(event.session_id, 1)[0]
    tracegen(event, this.endpoint)
  }
};

exports.create = function () {
  return new FilterAppJanusTracer();
};

// TODO: replace trace mocker with opentelemetry-js
// Link: https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-exporter-zipkin/README.md

async function tracegen (event, endpoint) {
  // mock a zipkin span
  var trace = [{
    "id": event.spanId || spanid(),
    "traceId": event.traceId.toString(),
    "timestamp": nano_now(event.timestamp),
    "duration": event.duration,
    "name": event.event,
    "localEndpoint": {
      "serviceName": event.name
    }
  }]
  if (event.parentId) { trace[0].parentId = event.parentId }
  if (event.tags) {
    trace[0].tags = event.tags
  } else {
    trace[0].tags = { event: 'hello' }
  }

  logger.info("trace: ", trace);
  // send event to endpoint
  if (endpoint) {
    const response = fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(trace),
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => {
        return res
      })
      .catch(err => {
        logger.error(err)
      });
    if (this.debug) logger.info(response);
  }
}
