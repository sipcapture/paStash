/* Janus Event Tracer (C) 2022 QXIP BV */

/* eslint-disable camelcase */
/* eslint-disable semi */
/* eslint quotes: 0 */
/* eslint-disable quote-props */
/* eslint-disable dot-notation */

var base_filter = require('@pastash/pastash').base_filter
var util = require('util')
var logger = require('@pastash/pastash').logger
var crypto = require('crypto')

const QuickLRU = require("quick-lru");

function nano_now (date) { return parseInt(date.toString().padEnd(16, '0')) }

function FilterAppJanusTracer () {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppJanusTracer',
    optional_params: [
      'debug',
      'bypass',
      'port',
      'metrics',
      'filter',
      'tracerName'
    ],
    default_values: {
      'metrics': false,
      'port': 9090,
      'bypass': false,
      'debug': false,
      'filter': ["1", "128", "2", "4", "8", "16", "32", "64", "256"],
      'tracerName': 'pastash_janus_trace'
    },
    start_hook: this.start.bind(this)
  });
}

util.inherits(FilterAppJanusTracer, base_filter.BaseFilter);

FilterAppJanusTracer.prototype.start = async function (callback) {
  // LRU
  this.lru = new QuickLRU({ maxSize: 10000, maxAge: 3600000, onEviction: false });
  var filterArray = []
  for (var i = 0; i < this.filter.length; i++) {
    filterArray.push([parseInt(this.filter[i]), "allow"])
  }
  this.filterMap = new Map(filterArray)
  this.ctx = new ContextManager(this, this.tracerName)
  this.ctx.init()
  logger.info('Initialized App Janus Span Tracer');
  callback();
};

FilterAppJanusTracer.prototype.process = function (data) {
  // bypass
  if (this.bypass) this.emit('output', data)
  if (!data.message) return;

  var line = JSON.parse(data.message);
  if (Array.isArray(line)) {
    line.forEach((item, i) => {
      this.ctx.process(item, this)
    })
  } else {
    this.ctx.process(line, this)
  }
}

exports.create = function () {
  return new FilterAppJanusTracer();
};

/*
  Context Manager
    Manage Parent, Child relations, tracks Sessions

    - Session_id is index
    - Event_id is secondary index
    - Uses Interval to flush spans and end sessions
    - Uses batching to send messages via array (size limit)
    - Session Parent sticks around to capture multi leave events
    - Manage Duration through start and end
    */

function ContextManager (self, tracerName, sessionObject) {
  /*
  Context Globals
  */
  this.filter = self
  this.name = tracerName
  this.lastflush = Date.now()

  /*
  Context Storage
  */
  this.sessionMap = new Map()
  this.buffer = []

  /*
  Initiator Function
  */
  this.init = function () {
    setInterval(this.check.bind(this), 500)
  }

  /*
    Processor Function
    */

  this.process = function (line) {
    // if (this.filter.debug) logger.info('Incoming line', line.type, line.event)
    /* Ignore all events not in filter */
    if (!self.filterMap.has(line.type)) return
    if (this.filter.debug) logger.info('Allowed through Filter', line.type, line.session_id, line.event)
    var event = {}

    if (line.type === 1) {
      // console.log('EVENT -----------', line)
      /* Template
      line.emitter
      line.type
      line.timestamp
      line.session_id
      line.event
      line.event.name -> created
      line.event.transport
      line.event.transport.id
      */
      event = {
        eventName: line.event.name,
        event: line.event.name,
        emitter: line.emitter,
        session_id: line?.session_id?.toString() || line?.session_id,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      /* CREATE event */
      if (line.event.name === 'created') {
        const sessionSpan = this.startSpan('Session', line, event, 'Session')
        const sessionCreateSpan = this.startSpan(
          'Session Created',
          line,
          event,
          'Session',
          sessionSpan.traceId,
          sessionSpan.id
        )
        sessionCreateSpan.end()
        const session = {
          session_id: line.session_id,
          lastEvent: Date.now(),
          traceId: sessionSpan.traceId,
          sessionSpanId: sessionSpan.id,
          sessionSpan: sessionSpan,
          sessionStatus: 'Open',
          transportId: line.event.transport.id
        }
        this.sessionMap.set(session.transportId, session)
        this.sessionMap.set(session.session_id, session)
        // logger.info('PJU -- Session event:', sessionSpan, session)
      /* DESTROY event */
      } else if (line.event.name === 'destroyed') {
        const session = this.sessionMap.get(line.session_id)
        const destroySpan = this.startSpan(
          'Session destroyed',
          line,
          event,
          'Session',
          session.traceId,
          session.sessionSpanId
        )
        destroySpan.end(session.lastEvent)
        session.sessionSpan.end(session.lastEvent)
        session.status = 'Closed'
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
      }
    /*
    TYPE 2 - Handle related event
    Handle Attachment and Detachment is traced
    */
    } else if (line.type === 2) {
      // console.log('EVENT -----------', line)
      /* Template
      line.emitter
      line.type
      line.timestamp
      line.session_id
      line.opaque_id
      line.event
      line.event.name
      line.event.plugin
      line.event.opaque_id
      */
      event = {
        eventName: line.event.name,
        event: line.event.name,
        emitter: line.emitter,
        opaque_id: line?.opaque_id?.toString() || line?.opaque_id,
        session_id: line?.session_id?.toString() || line?.session_id,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      /*
        Attach Event
        */
      if (line.event.name === 'attached') {
        const session = this.sessionMap.get(line.session_id)
        const handleSpan = this.startSpan(
          "Handle",
          line,
          event,
          'Handle',
          session.traceId,
          session.sessionSpanId
        )
        const attachedSpan = this.startSpan(
          "Handle attached",
          line,
          event,
          'Handle',
          session.traceId,
          handleSpan.id
        )
        attachedSpan.end(session.lastEvent)
        session.handleSpanId = handleSpan.id
        session.handleSpan = handleSpan
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
        /*
        Detach Event
        */
      } else if (line.event.name === 'detached') {
        const session = this.sessionMap.get(line.session_id)
        const detachedSpan = this.startSpan(
          "Handle detached",
          line,
          event,
          'Handle',
          session.traceId,
          session.handleSpanId
        )
        detachedSpan.end(session.lastEvent)
        session.handleSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
      }
    /*
      Type 4 - External event
      */
    } else if (line.type === 4) {
      // console.log('EVENT -----------', line)
      /* Template
      line.emitter
      line.type
      line.timestamp
      line.session_id
      line.event
      line.event.name
      */
      event = {
        eventName: "External Event",
        event: "External Event",
        session_id: line?.session_id?.toString() || line?.session_id,
        id: line?.session_id,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      const session = this.sessionMap.get(line.session_id)
      const extSpan = this.startSpan(
        "External Event",
        line,
        event,
        "External",
        session.traceId,
        session.sessionSpanId
      )
      extSpan.end(session.lastEvent)
      session.lastEvent = Date.now().toString()
      this.sessionMap.set(line.session_id, session)
    /*
      Type 8 - JSEP event
      */
    } else if (line.type === 8) {
      // console.log('EVENT -----------', line)
      /* Template
      line.emitter
      line.type
      line.timestamp
      line.session_id
      line.opaque_id
      line.event
      line.event.owner
      line.event.jsep
      line.event.jsep.type
      line.event.jsep.sdp
      */
      event = {
        eventName: line?.event?.jsep?.type,
        event: line?.event?.owner,
        session_id: line?.session_id?.toString() || line?.session_id,
        sdp_type: line?.event?.jsep?.type || 'null',
        sdp: line?.event?.jsep?.sdp || 'null',
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      /*
        Remote SDP
      */
      if (line.event.owner === "remote") {
        const session = this.sessionMap.get(line.session_id)
        const sdpSpan = this.startSpan(
          "JSEP Event - Offer",
          line,
          event,
          "JSEP",
          session.traceId,
          session.sessionSpanId
        )
        sdpSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
      /*
        Local SDP
      */
      } else if (line.event.owner === "local") {
        const session = this.sessionMap.get(line.session_id)
        const sdpSpan = this.startSpan(
          "JSEP Event - Answer",
          line,
          event,
          "JSEP",
          session.traceId,
          session.sessionSpanId
        )
        sdpSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
      }
    /*
      Type 16 - WebRTC state event
      */
    } else if (line.type === 16) {
      // console.log('EVENT -----------', line)
      /* Template
      line.emitter
      line.type
      line.subtype
      line.timestamp
      line.session_id
      line.opaque_id
      line.event
      line.event.ice
      */

      /*
        Subtype 1
        ICE flow
      */
      if (line.subtype === 1) {
        event = {
          eventName: "Ice Flow",
          type: line.type,
          subtype: line.subtype,
          event: line?.event?.ice,
          session_id: line?.session_id?.toString() || line?.session_id,
          ice_state: line?.event?.ice || 'null',
          timestamp: line.timestamp || nano_now(new Date().getTime())
        }
        if (line.event.ice === 'gathering') {
          const session = this.sessionMap.get(line.session_id)
          const iceSpan = this.startSpan(
            "ICE gathering",
            line,
            event,
            "ICE",
            session.traceId,
            session.sessionSpanId
          )
          session.iceSpanId = iceSpan.id
          session.iceSpan = iceSpan
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, session)
        } else if (event.ice_state === 'connecting') {
          const session = this.sessionMap.get(line.session_id)
          const conIceSpan = this.startSpan(
            "ICE connecting",
            line,
            event,
            "ICE",
            session.traceId,
            session.iceSpanId
          )
          conIceSpan.end(session.lastEvent)
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, session)
        } else if (line.event.ice === "connected") {
          const session = this.sessionMap.get(line.session_id)
          const conIceSpan = this.startSpan(
            "ICE connected",
            line,
            event,
            'ICE',
            session.traceId,
            session.iceSpanId
          )
          conIceSpan.end(session.lastEvent)
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, session)
        } else if (line.event.ice === "ready") {
          const session = this.sessionMap.get(line.session_id)
          const readySpan = this.startSpan(
            "ICE ready",
            line,
            event,
            'ICE',
            session.traceId,
            session.iceSpanId
          )
          readySpan.end(session.lastEvent)
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, session)
        }
      /*
        Subtype 2
        Local Candidates
      */
      } else if (line.subtype === 2) {
        event = {
          eventName: "Local Candidates",
          type: line.type,
          subtype: line.subtype,
          session_id: line?.session_id?.toString() || line?.session_id,
          candidate: line?.event["local-candidate"],
          timestamp: line.timestamp || nano_now(new Date().getTime())
        }
        const session = this.sessionMap.get(line.session_id)
        const candidateSpan = this.startSpan(
          "Local Candidate",
          line,
          event,
          'ICE',
          session.traceId,
          session.iceSpanId
        )
        candidateSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
      /*
        Subtype 3
        Remote Candidates
      */
      } else if (line.subtype === 3) {
        event = {
          eventName: "Remote Candidates",
          session_id: line?.session_id?.toString() || line?.session_id,
          candidate: line?.event["remote-candidate"],
          timestamp: line.timestamp || nano_now(new Date().getTime())
        }
        const session = this.sessionMap.get(line.session_id)
        const candidateSpan = this.startSpan(
          "Remote Candidate",
          line,
          event,
          'ICE',
          session.traceId,
          session.iceSpanId
        )
        candidateSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
      /*
        Subtype 4
        Connection Selected
      */
      } else if (line.subtype === 4) {
        event = {
          name: "Candidates selected",
          event: JSON.stringify(line?.event),
          session_id: line?.session_id?.toString() || line?.session_id,
          timestamp: line.timestamp || nano_now(new Date().getTime())
        }
        const session = this.sessionMap.get(line.session_id)
        const candidateSpan = this.startSpan(
          "Selected Candidates",
          line,
          event,
          'ICE',
          session.traceId,
          session.iceSpanId
        )
        candidateSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
      /*
        Subtype 5
        DTLS flow
      */
      } else if (line.subtype === 5) {
        event = {
          eventName: "DTLS flow",
          event: line?.event?.dtls,
          session_id: line?.session_id?.toString() || line?.session_id,
          timestamp: line.timestamp || nano_now(new Date().getTime())
        }
        /*
          trying
        */
        if (event.event === 'trying') {
          const session = this.sessionMap.get(line.session_id)
          const trySpan = this.startSpan(
            "DTLS trying",
            line,
            event,
            'ICE',
            session.traceId,
            session.iceSpanId
          )
          trySpan.end(session.lastEvent)
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, session)
        /*
          connected
        */
        } else if (event.event === 'connected') {
          const session = this.sessionMap.get(line.session_id)
          const conSpan = this.startSpan(
            "DTLS connected",
            line,
            event,
            'ICE',
            session.traceId,
            session.iceSpanId
          )
          conSpan.end(session.lastEvent)
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, session)
        }
      /*
        Subtype 6
        Connection Up
      */
      } else if (line.subtype === 6) {
        event = {
          eventName: "Connection Up",
          event: line?.event,
          session_id: line?.session_id?.toString() || line?.session_id,
          timestamp: line.timestamp || nano_now(new Date().getTime())
        }
        const session = this.sessionMap.get(line.session_id)
        const conSpan = this.startSpan(
          "WebRTC Connection UP",
          line,
          event,
          'ICE',
          session.traceId,
          session.iceSpanId
        )
        conSpan.end(session.lastEvent)
        session.iceSpan.end(session.lastEvent)
        if (this.metrics) {
          const mediaMetrics = {
            streams: []
          }

          const timestamp = this.nano_now(Date.now())

          mediaMetrics.streams.push({
            stream: {
              emitter: line.emitter,
              type: 16,
              session_id: event.session_id,
              metric: "ice_duration"
            },
            values: [
              [
                timestamp,
                "ice_duration",
                session.iceSpan.duration
              ]
            ]
          })

          this.emit('output', mediaMetrics)
        }
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
      }
    /*
      Type 32 - Media Report
    */
    } else if (line.type === 32) {
      if (this.filter.debug) console.log('EVENT 32 -----------', line)
      /* Template
      line.emitter
      line.type
      line.subtype
      line.timestamp
      line.session_id
      line.opaque_id
      line.event
      line.event.media
      line.event.rtt
      ...
      */
      event = {
        eventName: "Media Report",
        type: line.type,
        subtype: line.subtype,
        media: line.event.media,
        emitter: line?.emitter,
        session_id: line?.session_id?.toString() || line.session_id,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }

      if (line.event.media === "audio" && line.subtype === 3) {
        // console.log('event ----', event)
        const session = this.sessionMap.get(line.session_id)
        const mediaSpan = this.startSpan(
          "Audio Media Report",
          line,
          event,
          'Media',
          session.traceId,
          session.sessionSpanId
        )
        mediaSpan.annotations = [
          {
            timestamp: nano_now(Date.now()),
            value: JSON.stringify(line.event)
          }
        ]
        // console.log('mediaSpan -----------', mediaSpan)
        mediaSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
        /* Split out data and send to metrics counter */
        if (this.filter.metrics) {
          this.sendMetrics({
            metrics: JSON.stringify(line.event)
          }, this)
        }
      } else if (line.event.media === "video" && line.subtype === 3) {
        const session = this.sessionMap.get(line.session_id)
        const mediaSpan = this.startSpan(
          "Video Media Report",
          line,
          event,
          'Media',
          session.traceId,
          session.sessionSpanId
        )
        mediaSpan.annotations = [
          {
            timestamp: nano_now(Date.now()),
            value: JSON.stringify(line.event)
          }
        ]
        mediaSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
        /* Split out data and send to metrics counter */
        if (this.filter.metrics) {
          this.sendMetrics({
            metrics: JSON.stringify(line.event)
          }, this)
        }
      }
    /*
      Type 128 - Transport-originated
      */
    } else if (line.type === 128) {
      // console.log('Event ----', line)
      /*
      line.emitter
      line.type
      line.event
      line.event.transport
      line.event.id
      line.event.data
      line.event.data.event
      line.event.data.admin_api
      line.event.data.ip
      */
      // TODO: 128 comes first, needs to move up
      /*
      event = {
        name: line.event.data.event,
        adminApi: line.event.data.admin_api,
        ip: line.event.data.ip,
        transportId: line.event.id,
        emitter: line.emitter,
        transport: line.event.transport,
        type: line.type,
        timestamp: line.timestamp
      }
      const session = this.sessionMap.get(line.event.id)
      const transportSpan = this.startSpan(
        "Transport connected",
        line,
        event,
        "Transport Originated",
        session.traceId,
        session.sessionSpanId
      )
      transportSpan.end()
      session.lastEvent = Date.now().toString()
      this.sessionMap.set(session.session_id, session)
      this.sessionMap.set(line.event.id, session) */
    /*
      Type 256 - Core event
      */
    } else if (line.type === 256) {
      event = {
        eventName: "Status Event",
        server: line.emitter,
        subtype: line.subtype,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      if (event.subtype === 1) {
        const serverSpan = this.startSpan(
          "Startup",
          line,
          event,
          'Core'
        )
        serverSpan.end()
      } else if (event.subtype === 2) {
        const serverSpan = this.startSpan(
          "Shutdown",
          line,
          event,
          'Core'
        )
        serverSpan.end()
      }

    /*
    TYPE 64 - Plugin-originated event

    Users Joining or Leaving Sessions
    */
    } else if (line.type === 64) {
      // console.log('EVENT ----', line, line.event.data.event, line.event.data.name)
      /* Template
      line.emitter
      line.type
      line.subtype
      line.timestamp
      line.session_id
      line.opaque_id
      line.event
      line.event.media
      */
      event = {
        eventName: line.event.plugin,
        event: line.event.data.event,
        display: line.event.data?.display || 'null',
        id: line.event.data.id?.toString() || line.event.data.id,
        session_id: line?.session_id?.toString() || line.session_id,
        room: line.event.data.room?.toString() || line.event.data.room,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      if (!line.event.data) return
      /*
        Joined Event
        */
      if (line.event.data.event === 'joined') {
        const session = this.sessionMap.get(line.session_id)
        const joinSpan = this.startSpan(
          "User",
          line,
          event,
          'Plugin',
          session.traceId,
          session.sessionSpanId
        )
        session.joinSpanId = joinSpan.id
        session.joinSpan = joinSpan
        const joinedSpan = this.startSpan(
          "User joined",
          line,
          event,
          'Plugin',
          session.traceId,
          session.joinSpanId
        )
        joinedSpan.end(session.lastEvent)
        session.eventId = line.event.data.id
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, session)
        this.sessionMap.set(line.event.data.id, session)
        /*
        Configured Event
        */
      } else if (line.event.data.event === 'configured') {
        console.log('CONF', line, line.event.data.id, line?.session_id)
        const session = this.sessionMap.get(line.event.data.id)
        const confSpan = this.startSpan(
          "User configured",
          line,
          event,
          'Plugin',
          session.traceId,
          session.joinSpanId
        )
        session.confSpan = confSpan
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.event.data.id, session)
        /*
        Published Event
        */
      } else if (line.event.data.event === 'published') {
        const session = this.sessionMap.get(line.event.data.id)
        const pubSpan = this.startSpan(
          "User published",
          line,
          event,
          'Plugin',
          session.traceId,
          session.joinSpanId
        )
        session.pubSpan = pubSpan
        session.confSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.event.data.id, session)
        /*
        Subscribing Event
        */
      } else if (line.event.data.event === 'subscribing') {
        const session = this.sessionMap.get(line.event.data.id)
        const subSpan = this.startSpan(
          "User subscribing",
          line,
          event,
          'Plugin',
          session.traceid,
          session.joinSpanId
        )
        session.subSpan = subSpan
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.event.data.id, session)
        /*
        Subscribed Event
        */
      } else if (line.event.data.event === 'subscribed') {
        const session = this.sessionMap.get(line.event.data.id)
        session.subSpan.end(session.lastEvent)
        /*
        Update Event
        */
      } else if (line.event.data.event === 'updated') {
        const session = this.sessionMap.get(line.event.data.id)
        const upSpan = this.startSpan(
          "User updated",
          line,
          event,
          'Plugin',
          session.traceId,
          session.joinSpanId
        )
        upSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.event.data.id, session)
        this.sessionMap.set(session.session_id, session)
        /*
        Unpublished Event
        */
      } else if (line.event.data.event === 'unpublished') {
        const session = this.sessionMap.get(line.event.data.id)
        const unpubSpan = this.startSpan(
          "User unpublished",
          line,
          event,
          'Plugin',
          session.traceId,
          session.joinSpanId
        )
        unpubSpan.end(session.lastEvent)
        try {
          session.pubSpan.end(session.lastEvent)
          session.pubSpan.end = () => {}
        } catch (e) {
          // swallow error
        }
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.event.data.id, session)
        /*
        Leaving Event
        */
      } else if (line.event.data.event === 'leaving') {
        const session = this.sessionMap.get(line.event.data.id)
        const leaveSpan = this.startSpan(
          "User leaving",
          line,
          event,
          'Plugin',
          session.traceId,
          session.joinSpanId
        )
        leaveSpan.end(session.lastEvent)
        session.joinSpan.end(session.lastEvent)
        session.joinSpan.end = () => {}
        session.lastEvent = Date.now().toString()
        session.status = 'Closed'
        this.sessionMap.set(line.event.data.id, session)
        this.sessionMap.set(session.session_id, session)
      }
    }
  }

  this.startSpan = function (name, line, event, service, traceId, parentId) {
    const span = {}
    const context = this
    span.id = this.generateSpanId()
    span.name = name
    span.tags = event
    span.attributes = event
    span.timestamp = nano_now(Date.now())
    span.localEndpoint = {
      serviceName: service
    }
    span['service.name'] = service
    span.kind = "SERVER"
    span.start = nano_now(Date.now())
    span.duration = 0
    span.end = function (lastEvent) {
      // console.log('SPAN ----', span)
      span.duration = nano_now(Date.now()) - span.start
      if (lastEvent) { span.tags.lastEvent = lastEvent }
      context.buffer.push(span)
    }
    if (traceId) {
      span.traceId = traceId
    } else {
      span.traceId = this.generateTraceId()
    }
    if (parentId) {
      span.parentId = parentId
    }
    if (this.filter.debug) { console.log('span ---', span) }
    return span
  }

  this.check = function () {
    // console.log('this', this)
    const sinceLast = Date.now() - this.lastflush
    if (this.buffer.length > 15 || (this.buffer.length > 0 && sinceLast > 10000)) {
      this.lastflush = Date.now()
      this.flush()
      this.sessionMap.forEach((session, key) => {
        // Check timeout of session
        // console.log(session)
        try {
          if (Date.now() - session.lastEvent > (1000 * 10) && session.status === 'Closed') {
            console.log('Deleting session from sessionMap, 10 sec timeout and closed')
            this.sessionMap.delete(key)
            this.sessionMap.delete(session?.pluginId)
            this.sessionMap.delete(session?.transportId)
          } else if (Date.now() - session.lastEvent > (1000 * 24 * 60 * 60)) {
            console.log('Deleting session from sessionMap, older than 24 hours')
            this.sessionMap.delete(key)
            this.sessionMap.delete(session?.pluginId)
            this.sessionMap.delete(session?.transportId)
          }
        } catch (e) {
          // swallow e
          console.log('sessionMap', e)
        }
      })
    }
  }

  this.flush = function () {
    // console.log('flushing', this.buffer)
    const swap = [...this.buffer]
    if (this.filter.debug) console.log('SWAP', swap)
    this.buffer = []
    // if (this.filter.debug) console.log(string)
    this.filter.emit('output', swap)
  }

  /*
    Helper Functions
  */

  this.generateTraceId = function () {
    const buffer = new ArrayBuffer(16)
    const view = new Int8Array(buffer)
    const random = crypto.randomFillSync(view)
    return this.bufferToHex(random)
  }

  this.generateSpanId = function () {
    const buffer = new ArrayBuffer(8)
    const view = new Int8Array(buffer)
    const random = crypto.randomFillSync(view)
    return this.bufferToHex(random)
  }

  this.bufferToHex = function (buffer) {
    return [...new Uint8Array(buffer)]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
  }

  this.nano_now = function (date) {
    return date.toString().padEnd(16, '0')
  }

  this.sendMetrics = function (event) {
    if (this.filter.debug) logger.info('Event Metrics', event)

    const mediaMetrics = {
      streams: []
    }

    const timestamp = this.nano_now(Date.now())

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "local_lost_packets"
      },
      values: [
        [
          timestamp,
          "local_lost_packets",
          event.metrics["lost"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "remote_lost_packets"
      },
      values: [
        [
          timestamp,
          "remote_lost_packets",
          event.metrics["lost-by-remote"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "local_jitter"
      },
      values: [
        [
          timestamp,
          "local_jitter",
          event.metrics["jitter-local"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "remote_jitter"
      },
      values: [
        [
          timestamp,
          "remote_jitter",
          event.metrics["jitter-remote"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "in_link_quality"
      },
      values: [
        [
          timestamp,
          "in_link_quality",
          event.metrics["in-link-quality"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "in_media_link_quality"
      },
      values: [
        [
          timestamp,
          "in_media_link_quality",
          event.metrics["in-media-link-quality"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "out_link_quality"
      },
      values: [
        [
          timestamp,
          "out_link_quality",
          event.metrics["out-link-quality"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "out_media_link_quality"
      },
      values: [
        [
          timestamp,
          "out_media_link_quality",
          event.metrics["out-media-link-quality"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "packets_received"
      },
      values: [
        [
          timestamp,
          "packets_received",
          event.metrics["packets-received"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "packets_sent"
      },
      values: [
        [
          timestamp,
          "packets_sent",
          event.metrics["packets-sent"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "bytes_received"
      },
      values: [
        [
          timestamp,
          "bytes_received",
          event.metrics["bytes-received"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "bytes_sent"
      },
      values: [
        [
          timestamp,
          "bytes_sent",
          event.metrics["bytes-sent"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "bytes_received_lastsec"
      },
      values: [
        [
          timestamp,
          "bytes_received_lastsec",
          event.metrics["bytes-received-lastsec"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "bytes_sent_lastsec"
      },
      values: [
        [
          timestamp,
          "bytes_sent_lastsec",
          event.metrics["bytes-sent-lastsec"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "nacks_received"
      },
      values: [
        [
          timestamp,
          "nacks_received",
          event.metrics["nacks-received"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "nacks_sent"
      },
      values: [
        [
          timestamp,
          "nacks_sent",
          event.metrics["nacks-sent"]
        ]
      ]
    })
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: 32,
        session_id: event.session_id,
        metric: "retransmission_received"
      },
      values: [
        [
          timestamp,
          "retransmission_received",
          event.metrics["retransmission-received"]
        ]
      ]
    })

    this.filter.emit('output', mediaMetrics)
  }
}
