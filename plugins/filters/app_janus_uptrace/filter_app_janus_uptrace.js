/* Janus Event Tracer using Uptrace and OTEL (C) 2022 QXIP BV */

/* eslint-disable camelcase */
/* eslint quotes: 0 */
/* eslint-disable quote-props */
/* eslint-disable dot-notation */

var base_filter = require('@pastash/pastash').base_filter
var util = require('util')
var logger = require('@pastash/pastash').logger

const QuickLRU = require('quick-lru')

const otel = require('@opentelemetry/api')
const uptrace = require('@uptrace/node')

function nano_now (date) { return parseInt(date.toString().padEnd(16, '0')) }
function just_now (date) { return nano_now(date || new Date().getTime()) }
function spanid () { return Math.floor(10000000 + Math.random() * 90000000).toString() }

function FilterAppJanusTracer () {
  base_filter.BaseFilter.call(this)
  this.mergeConfig({
    name: 'AppJanusTracer',
    optional_params: ['debug', 'endpoint', 'bypass', 'port', 'metrics', 'service_name', 'interval'],
    default_values: {
      'endpoint': 'http://localhost:3100/tempo/api/push',
      'service_name': 'pastash-janus',
      'interval': 10000,
      'port': 9090,
      'bypass': true,
      'debug': false
    },
    start_hook: this.start.bind(this)
  })
}

util.inherits(FilterAppJanusTracer, base_filter.BaseFilter)

FilterAppJanusTracer.prototype.start = async function (callback) {
  // LRU to track across sessions
  this.lru = new QuickLRU({ maxSize: 10000, maxAge: 3600000, onEviction: false })
  this.otel = otel
  uptrace
    .configureOpentelemetry({
      dsn: this.endpoint,
      serviceName: this.service_name,
      serviceVersion: '0.0.1'
    })
    .start()
    .then(callback.bind(this))
}

FilterAppJanusTracer.prototype.process = async function (data) {
  /* check if we already have a global tracer */
  var tracer
  if (this.lru.has('tracer_instance')) {
    /* if yes, return current tracer */
    tracer = this.lru.get('tracer_instance')
  } else {
    /* if not, create a new tracer */
    tracer = otel.trace.getTracer('pastash_janus_uptrace', 'v0.0.1')
    this.lru.set('tracer_instance', tracer)
  }

  logger.info('PJU -- Tracer tracking event', this.lru.has('tracer_instance'))

  // bypass
  if (this.bypass) this.emit('output', data)
  if (!data.message) return
  var event = {}
  var line = JSON.parse(data.message)
  logger.info('Incoming line', line.type, line.event)
  /* Ignore all other events */
  if (line.type === 128 || line.type === 8 || line.type === 16 || line.type === 32) return
  // logger.info('Filtered to 1, 2, 64', line.type, line.session_id, line.handle_id)
  /*
  TYPE 1

  Create Session and Destroy Session events are tracked
  */
  if (line.type == 1) {
    event = {
      name: line.event.name,
      event: line.event.name,
      session_id: line.session_id,
      traceId: line.session_id,
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }
    /* CREATE event */
    if (event.name === "created") {
      const sessionSpan = tracer.startSpan("Session", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      })
      logger.info('PJU -- Session event:', sessionSpan)
      this.lru.set("sess_" + event.session_id, sessionSpan)
      // create root span
      // this.lru.set(event.session_id, event)
      // start root trace, do not update
      /*
      this.sessions.add(event.session_id, just_now(event.timestamp))
      this.sessions.add('uuid_' + event.session_id, event.traceId)
      this.sessions.add('span_' + event.session_id, event.spanId)
      this.sessions.add('parent_' + event.session_id, event.spanId)
      if (this.metrics) this.counters['s'].add(1, line.event)
      */
    /* DESTROY event */
    } else if (event.name === "destroyed") {
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      logger.info('PJU -- Sending span', sessionSpan)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const destroySpan = tracer.startSpan("Session destroyed", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      destroySpan.end()
      sessionSpan.end()
      this.lru.delete("sess_" + event.session_id)
      /*
      const createEvent = this.lru.get(event.session_id)
      createEvent.duration = just_now(event.timestamp) - just_now(createEvent.timestamp)
      */
      /* name the event Session
      createEvent.name = "Session " + event.session_id
      if (this.metrics) this.counters['s'].add(-1, line.event)
      // logger.info('type 1 destroyed sending', createEvent)
      createEvent.tags = createEvent
      tracegen(createEvent, this.endpoint)
      event.duration = 1000
      event.name = "Destroyed " + event.id
      event.parentId = createEvent.spanId
      event.tags = event
      tracegen(event, this.endpoint)
      // delete root span
      this.lru.delete(event.session_id)
      // end root trace
      this.sessions.remove(event.session_id)
      this.sessions.remove('uuid_' + event.session_id)
      this.sessions.remove('span_' + event.session_id, event.spanId)
      this.sessions.remove('parent_' + event.session_id, event.spanId)
      */
    }
  /*
  TYPE 2

  Client Attachment and Detachment is tracked
  */
  } else if (line.type == 2) {

    event = {
      name: line.event.name,
      event: line.event.name,
      session_id: line.session_id,
      id: line.session_id,
      spanId: spanid(),
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }
    /*
      Attach Event
      */
    if (event.name === "attached") {
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const attachedSpan = tracer.startSpan("Session attached", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      attachedSpan.end()
      /*
      Detach Event
      */
    } else if (event.name === "detached") {
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const detachedSpan = tracer.startSpan("Sessiond detached", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      detachedSpan.end()
    }
  /*
  TYPE 64

  Users Joining or Leaving Sessions
  */
  } else if (line.type == 64) {

    event = {
      name: line.event.plugin,
      event: line.event.data.event,
      display: line.event.data?.display || "null",
      id: line.event.data.id,
      session_id: line?.session_id,
      room: line.event.data.room,
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }
    if (!line.event.data) return

    // logger.info("trace 64: ", line)
    /*
      Joined Event
      */
    if (event.event === "joined") {
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const joinSpan = tracer.startSpan("User joined", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      this.lru.set("join_" + event.id, joinSpan)

      /*
      Configured Event
      */
    } else if (event.event === "configured") {
      const joinSpan = this.lru.get('join_' + event.id)
      const ctx = otel.trace.setSpan(otel.context.active(), joinSpan)
      const confSpan = tracer.startSpan("User configured", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      confSpan.end()
      /*
      Published Event
      */
    } else if (event.event === "published") {
      const joinSpan = this.lru.get('join_' + event.id)
      const ctx = otel.trace.setSpan(otel.context.active(), joinSpan)
      const pubSpan = tracer.startSpan("User published", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      this.lru.set("pub_" + event.id, pubSpan)
      /*
      Subscribing Event
      */
    } else if (event.event === "subscribing") {
      const joinSpan = this.lru.get('join_' + event.id)
      const ctx = otel.trace.setSpan(otel.context.active(), joinSpan)
      const subSpan = tracer.startSpan("User subscribing", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      this.lru.set("sub_" + event.session_id, subSpan)
      /*
      Subscribed Event
      */
    } else if (event.event === "subscribed") {
      const subSpan = this.lru.get('sub_' + event.session_id)
      subSpan.end()
      /*
      Update Event
      */
    } else if (event.event === "updated") {
      const joinSpan = this.lru.get('join_' + event.id)
      const ctx = otel.trace.setSpan(otel.context.active(), joinSpan)
      const upSpan = tracer.startSpan("User updated", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      upSpan.end()
      /*
      Unpublished Event
      */
    } else if (event.event === "unpublished") {
      const joinSpan = this.lru.get('join_' + event.id)
      const ctx = otel.trace.setSpan(otel.context.active(), joinSpan)
      const unpubSpan = tracer.startSpan("User unpublished", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      unpubSpan.end()
      const pubSpan = this.lru.get('pub_' + event.id)
      pubSpan.end()
      /*
      Leaving Event
      */
    } else if (event.event === "leaving") {
      // correlate: event.data.id --> session_id
      try {
        const joinSpan = this.lru.get('join_' + event.id)
        const ctx = otel.trace.setSpan(otel.context.active(), joinSpan)
        const leaveSpan = tracer.startSpan("User leaving", {
          attributes: event,
          kind: otel.SpanKind.SERVER
        }, ctx)
        leaveSpan.end()
        joinSpan.end()
      } catch (e) {
        console.log(e)
      }
    }
  }
}

exports.create = function () {
  return new FilterAppJanusTracer()
}

/* promise wrapper */
