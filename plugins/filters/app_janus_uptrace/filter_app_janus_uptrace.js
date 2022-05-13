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
      const sessionSpan = await createSpan(event.session_id + " -- Session")
      logger.info('PJU -- Session event Span', sessionSpan)
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
      const destroySpan = await createSpan(event.session_id + " -- Session destroyed")
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
      const attachedSpan = await createSpan(event.session_id + " -- Client attached")
      attachedSpan.end()
      /*
      event.parentId = this.sessions.get("parent_" + event.session_id, 1)[0]
      event.traceId = event.session_id
      this.lru.set("att_" + event.session_id, event)

      Detach Event
      */
    } else if (event.name === "detached") {
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const detachedSpan = await createSpan(event.session_id + " -- Client detached")
      detachedSpan.end()
      /*
      const attEvent = this.lru.get("att_" + event.session_id)
      if (!attEvent) return
      attEvent.duration = just_now(event.timestamp) - just_now(attEvent.timestamp)
      attEvent.name = "Attached " + event.session_id
      // logger.info('type 2 detached sending', event)
      attEvent.tags = attEvent
      tracegen(attEvent, this.endpoint)
      event.name = "Detached " + event.session_id
      event.parentId = attEvent.parentId
      event.traceId = event.session_id
      event.duration = 1000
      event.tags = event
      tracegen(event, this.endpoint)
      this.lru.delete("att_" + event.session_id)
      */
    }
  /*
  TYPE 64

  Users Joining or Leaving Sessions
  */
  } else if (line.type == 64) {
    /*
    event = {
      name: line.event.plugin,
      event: line.event.data.event,
      id: line.event.data.id,
      spanId: spanid(),
      room: line.event.data.room,
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }
    if (!line.event.data) return

    // logger.info("trace 64: ", line)

      Joined Event

    if (event.event === "joined") {
      event.display = line.event.data?.display || "null"
      event.session_id = line.session_id
      event.traceId = event.session_id
      event.parentId = this.sessions.get('parent_' + event.session_id, 1)[0] || spanid()
      console.log("JOIN ", event)
      // session_id, handle_id, opaque_id, event.data.id
      // correlate: session_id --> event.data.id
      this.lru.set("join_" + event.id, event)
      // increase tag counter
      if (this.metrics) this.counters['e'].add(1, line.event.data)

      Configured Event

    } else if (event.event === "configured") {
      Set start time of configured as start of join,
         emit span when published is received
      event.session_id = line.session_id
      event.traceId = event.session_id
      event.parentId = this.sessions.get('parent_' + event.session_id, 1)[0] || spanid()
      emit configured event
      const joinEvent = this.lru.get("join_" + event.id)
      event.duration = just_now(event.timestamp) - just_now(joinEvent.timestamp)
      event.timestamp = joinEvent.timestamp
      event.name = "Configured " + event.id + ", Room " + event.room
      // logger.info('type 64 configured sending', event)
      event.tags = event
      tracegen(event, this.endpoint)

      Published Event

    } else if (event.event === "published") {
      event.session_id = line.session_id
      event.display = line.event?.display
      event.traceId = event.session_id
      event.parentId = this.sessions.get('parent_' + event.session_id, 1)[0] || spanid()
      this.lru.set("pub_" + event.id, event)

      Subscribing Event

    } else if (event.event === "subscribing") {
      event.session_id = line.session_id
      event.id = event.session_id
      event.traceId = event.session_id
      event.parentId = this.sessions.get('parent_' + event.session_id, 1)[0] || spanid()
      this.lru.set("sub_" + event.session_id, event)

      Subscribed Event

    } else if (event.event === "subscribed") {
       Set start time to be subscribing event,
          emit when subscription suceeds

      event.session_id = line.session_id
      event.id = event.session_id
      event.traceId = event.session_id
      var subEvent = this.lru.get("sub_" + event.session_id)
      event.parentId = subEvent.parentId
      event.duration = just_now(event.timestamp) - just_now(subEvent.timestamp)
      event.timestamp = subEvent.timestamp
      event.name = "Subscribed " + event.session_id + ", Room " + event.room
      // logger.info('type 64 subscribed sending', event)
      event.tags = event
      tracegen(event, this.endpoint)
      this.lru.delete("sub_" + event.session_id)
      // TODO: add streams object to tags

      Update Event

    } else if (event.event === "updated") {
      event.session_id = line.session_id
      event.id = event.session_id
      event.traceId = event.session_id
      event.parentId = this.sessions.get('parent_' + event.session_id, 1)[0] || spanid()
      event.duration = 1000
      event.name = "Updated " + event.session_id + ", Room " + event.room
      event.tags = event
      tracegen(event, this.endpoint)

      Unpublished Event

    } else if (event.event === "unpublished") {
      // correlate: event.data.id --> session_id
      const pubEvent = this.lru.get("pub_" + event.id)
      if (!pubEvent) return
      pubEvent.duration = just_now(event.timestamp) - just_now(pubEvent.timestamp)
      pubEvent.name = "Published " + event.id + " / Display Name: " + pubEvent?.display + ", Room " + event.room
      // logger.info('type 64 unpublished sending', pubEvent)
      pubEvent.tags = pubEvent
      tracegen(pubEvent, this.endpoint)
      event.name = "Unpublished " + event.id + " / Display Name: " + pubEvent?.display + ", Room " + event.room
      event.duration = 1000
      event.parentId = pubEvent.parentId
      event.traceId = pubEvent.session_id
      event.tags = event
      tracegen(event, this.endpoint)
      this.lru.delete("pub_" + event.id)

      Leaving Event

    } else if (event.event === "leaving") {
      // correlate: event.data.id --> session_id
      try {
        const joinEvent = this.lru.get('join_' + event.id)
        if (!joinEvent) return
        joinEvent.duration = just_now(event.timestamp) - just_now(joinEvent.timestamp)
        joinEvent.name = "User " + event.id + " / Display Name: " + joinEvent?.display + ", Room " + event.room
        // logger.info('type 64 leaving sending', event)
        joinEvent.tags = joinEvent
        tracegen(joinEvent, this.endpoint)
        event.display = line.event.data?.display || "null"
        event.duration = 1000
        event.parentId = joinEvent.parentId
        event.traceId = joinEvent.session_id
        event.name = "User " + event.id + " leaving / Display Name: " + joinEvent?.display + ", Room " + event.room
        event.tags = event
        tracegen(event, this.endpoint)
        this.lru.delete('join_' + event.id)
      } catch (e) {
        console.log(e)
      }
      // decrease tag counter
      if (this.metrics) this.counters['e'].add(-1, line.event.data)
    } */
  }
}

exports.create = function () {
  return new FilterAppJanusTracer()
}

/* promise wrapper */

function createSpan (label) {
  return new Promise((resolve, reject) => {
    this.tracer.startActiveSpan(label, resolve)
  })
}
