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
    optional_params: ['debug', 'endpoint', 'bypass', 'service_name', 'filter'],
    default_values: {
      'endpoint': 'http://token@uptrace.host.ip:14318/<project_id>',
      'service_name': 'pastash-janus',
      'bypass': true,
      'filter': [1, 128, 2, 4, 8, 16, 32, 64, 256],
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
  var filterArray = []
  for (var i = 0; i < this.filter.length; i++) {
    filterArray.push([this.filter[i], "allow"])
  }
  this.filterMap = new Map(filterArray)
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

  // logger.info('PJU -- Tracer tracking event', this.lru.has('tracer_instance'))

  // bypass
  if (this.bypass) this.emit('output', data)
  if (!data.message) return
  var event = {}
  var line = JSON.parse(data.message)
  // logger.info('Incoming line', line.type, line.event)
  /* Ignore all other events */
  if (!this.filterMap.has(line.type)) return
  // logger.info('Filtered to 1, 2, 64', line.type, line.session_id, line.handle_id)
  /*
  TYPE 1

  Create Session and Destroy Session events are tracked
  */
  if (line.type == 1) {
    event = {
      name: line.event.name,
      event: line.event.name,
      session_id: line?.session_id?.toString() || line?.session_id,
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }
    /* CREATE event */
    if (event.name === "created") {
      const sessionSpan = tracer.startSpan("Session", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      })
      sessionSpan.setAttribute('service.name', 'Session')
      // logger.info('PJU -- Session event:', sessionSpan)
      this.lru.set("sess_" + event.session_id, sessionSpan)
    /* DESTROY event */
    } else if (event.name === "destroyed") {
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      // logger.info('PJU -- Sending span', sessionSpan)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const destroySpan = tracer.startSpan("Session destroyed", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      destroySpan.setAttribute('service.name', 'Session')
      destroySpan.end()
      sessionSpan.end()
      this.lru.delete("sess_" + event.session_id)
    }
  /*
  TYPE 2

  Client Attachment and Detachment is tracked
  */
  } else if (line.type == 2) {
    event = {
      name: line.event.name,
      event: line.event.name,
      session_id: line?.session_id?.toString() || line?.session_id,
      id: line?.session_id,
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }
    /*
      Attach Event
      */
    if (event.name === "attached") {
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const attachedSpan = tracer.startSpan("Handle attached", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      attachedSpan.setAttribute('service.name', 'Handle')
      this.lru.set("att_" + event.session_id, attachedSpan)
      /*
      Detach Event
      */
    } else if (event.name === "detached") {
      const attachedSpan = this.lru.get("att_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), attachedSpan)
      const detachedSpan = tracer.startSpan("Handle detached", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      detachedSpan.setAttribute('service.name', 'Handle')
      detachedSpan.end()
      attachedSpan.end()
    }
  /*
  TYPE 64

  Users Joining or Leaving Sessions
  */
  } else if (line.type == 64) {
    event = {
      name: line.event.plugin,
      event: line.event.data.event,
      display: line.event.data?.display || 'null',
      id: line.event.data.id.toString(),
      session_id: line?.session_id?.toString() || line.session_id,
      room: line.event.data.room?.toString() || line.event.data.room,
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
      joinSpan.setAttribute('service.name', 'Plugin')
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
      confSpan.setAttribute('service.name', 'Plugin')
      this.lru.set("conf_" + event.id, confSpan)
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
      pubSpan.setAttribute('service.name', 'Plugin')
      this.lru.set("pub_" + event.id, pubSpan)

      const confSpan = this.lru.get('conf_' + event.id)
      confSpan.end()
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
      subSpan.setAttribute('service.name', 'Plugin')
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
      upSpan.setAttribute('service.name', 'Plugin')
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
      unpubSpan.setAttribute('service.name', 'Plugin')
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
        leaveSpan.setAttribute('service.name', 'Plugin')
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
