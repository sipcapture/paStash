/* Janus Event Tracer (C) 2022 QXIP BV */

/* eslint-disable camelcase */
/* eslint-disable semi */
/* eslint quotes: 0 */
/* eslint-disable quote-props */
/* eslint-disable dot-notation */

'use strict';

const base_filter = require('@pastash/pastash').base_filter
const util = require('util')
const logger = require('@pastash/pastash').logger
const crypto = require('crypto')
const { Kafka } = require('kafkajs')
const QuickLRU = require("quick-lru")
const sender = require('./httpSender')

function FilterAppJanusTracer () {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppJanusTracer',
    optional_params: [
      'debug',
      'bufferSize',
      'metrics',
      'filter',
      'tracerName',
      'kafkaSending',
      'kafkaHost',
      'httpSending',
      'httpHost',
      'sendSize'
    ],
    default_values: {
      'debug': false,
      'bufferSize': 15,
      'metrics': false,
      'filter': ["1", "128", "2", "4", "8", "16", "32", "64", "256"],
      'tracerName': 'pastash_janus_tracer',
      'kafkaSending': false,
      'kafkaHost': '127.0.0.1:9092',
      'httpSending': true,
      'httpHost': 'http://127.0.0.1:3100',
      'sendSize': 5
    },
    start_hook: this.start.bind(this)
  });
}

util.inherits(FilterAppJanusTracer, base_filter.BaseFilter);

FilterAppJanusTracer.prototype.start = async function (callback) {
  if (this.kafkaSending) {
    /* Kafka client */
    this.kafka = new Kafka({
      clientId: 'my-app',
      brokers: [this.kafkaHost],
      enforceRequestTimeout: false
    })
    this.producer = this.kafka.producer()
    await this.producer.connect()
    logger.info('Kafka Client connected to ', this.kafkaHost)
  }

  /* Type Filter setup */
  let filterArray = []
  for (let i = 0; i < this.filter.length; i++) {
    filterArray.push([parseInt(this.filter[i]), "allow"])
  }
  this.filterMap = new Map(filterArray)
  filterArray = null
  /* LRU setup */
  this.lru = new QuickLRU({ maxSize: 10000, maxAge: 3600000, onEviction: false });
  /* Context Manager setup */
  this.ctx = new ContextManager(this, this.tracerName, this.lru)
  this.ctx.init()
  logger.info('Initialized App Janus Span + Metrics Tracer');
  sender.init(this)

  this.histogram = new (require('./prometheus').client.Histogram)({
    name: 'real_rtt',
    help: 'metric_help',
    buckets: [10, 200, 400, 700, 1500],
    labelNames: ['emitter', 'server', 'client']
  }); //new histogram([10, 200, 400, 700, 1500], 'real_rtt');
  require('./prometheus').registry.registerMetric(this.histogram);
  require('./prometheus').emitter.on('data', data => {
    if (!data.streams.length) {
      return
    }
    sender.sendMetrics(data);
  });

  callback();
};

FilterAppJanusTracer.prototype.process = function (data) {
  if (!data.message) return;

  let line = JSON.parse(data.message);
  if (Array.isArray(line)) {
    line.forEach((item, i) => {
      this.ctx.process(item, this)
    })
  } else {
    this.ctx.process(line, this)
  }
  line = null
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

function ContextManager (self, tracerName, lru) {
  /*
  Context Globals
  */
  this.filter = self
  this.name = tracerName
  this.lastflush = Date.now()

  /*
  Context Storage
  */
  this.sessionMap = lru
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

  this.process = async function (line) {
    // if (this.filter.debug) logger.info('Incoming line', line.type, line.event)
    /* Ignore all events not in filter */
    if (!self.filterMap.has(line.type)) return
    if (this.filter.debug) logger.info('Allowed through Filter', line.type, line.session_id, line.event)
    let event = {}

    if (line.type === 1) {
      // logger.info('EVENT -----------', line)
      /* Template
      line.emitter
      line.type
      line.timestamp
      line.session_id
      line.event
      line.event.name -> created
      line.event.transport
      line.event.transport?.id || 'undef'
      */
      event = {
        eventName: line.event.name,
        event: line.event.name,
        emitter: line.emitter,
        session_id: line?.session_id?.toString() || line?.session_id,
        timestamp: line.timestamp || this.nano_now(new Date().getTime())
      }
      /* CREATE event */
      if (line.event.name === 'created') {
        const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
        const sessionCreateSpan = this.startSpan(
          'Session Created',
          { ...line },
          { ...event },
          'Session',
          sessionSpan.traceId,
          sessionSpan.id
        )
        sessionCreateSpan.end()
        const session = {
          session_id: line.session_id,
          lastEvent: Date.now().toString(),
          traceId: sessionSpan.traceId,
          sessionSpanId: sessionSpan.id,
          sessionSpan: sessionSpan,
          status: 'Open',
          transportId: line.event.transport?.id || 'undef'
        }
        this.sessionMap.set(session.session_id, { ...session })
        // logger.info('PJU -- Session event:', sessionSpan, session)
      /* DESTROY event */
      } else if (line.event.name === 'destroyed') {
        let session = this.sessionMap.get(line.session_id)
        /* Termination of a session that was already in place */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        const destroySpan = this.startSpan(
          'Session destroyed',
          { ...line },
          { ...event },
          'Session',
          session.traceId,
          session.sessionSpanId
        )
        destroySpan.end(session.lastEvent)
        session.sessionSpan.end(session.lastEvent)
        session.sessionSpan = null
        session.status = 'Closed'
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
      }
    /*
    TYPE 2 - Handle related event
    Handle Attachment and Detachment is traced
    */
    } else if (line.type === 2) {
      // logger.info('EVENT -----------', line)
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
        timestamp: line.timestamp || this.nano_now(new Date().getTime())
      }
      /*
        Attach Event
        */
      if (line.event.name === 'attached') {
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        const handleSpan = this.startSpan(
          "Handle",
          { ...line },
          { ...event },
          'Handle',
          session.traceId,
          session.sessionSpanId
        )
        const attachedSpan = this.startSpan(
          "Handle attached",
          { ...line },
          { ...event },
          'Handle',
          session.traceId,
          handleSpan.id
        )
        attachedSpan.end(session.lastEvent)
        try {
          session.handleSpanId = handleSpan.id
          session.handleSpan = handleSpan
        } catch (e) {
          /* swallow error */
          if (this.filter.debug) logger.info(e)
        }
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
        /*
        Detach Event
        */
      } else if (line.event.name === 'detached') {
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        const detachedSpan = this.startSpan(
          "Handle detached",
          { ...line },
          { ...event },
          'Handle',
          session.traceId,
          session.handleSpanId || session.sessionSpanId
        )
        detachedSpan.end(session.lastEvent)
        try {
          session.handleSpan.end(session.lastEvent)
          session.handleSpan = null
        } catch (e) {
          /* swallow error */
          if (this.filter.debug) logger.info(e)
        }
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
      }
    /*
      Type 4 - External event
      */
    } else if (line.type === 4) {
      // logger.info('EVENT -----------', line)
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
        timestamp: line.timestamp || this.nano_now(new Date().getTime())
      }
      let session = this.sessionMap.get(line.session_id)
      /* Capture Starts mid-Session */
      if (!session) {
        const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
        session = {
          session_id: line.session_id,
          lastEvent: Date.now().toString(),
          traceId: sessionSpan.traceId,
          sessionSpanId: sessionSpan.id,
          sessionSpan: sessionSpan,
          status: 'Open',
          transportId: line.event.transport?.id || 'undef'
        }
      }
      const extSpan = this.startSpan(
        "External Event",
        { ...line },
        { ...event },
        "External",
        session.traceId,
        session.sessionSpanId
      )
      extSpan.end(session.lastEvent)
      session.lastEvent = Date.now().toString()
      this.sessionMap.set(line.session_id, { ...session })
    /*
      Type 8 - JSEP event
      */
    } else if (line.type === 8) {
      // logger.info('EVENT -----------', line)
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
        timestamp: line.timestamp || this.nano_now(new Date().getTime())
      }
      /*
        Remote SDP
      */
      if (line.event.owner === "remote") {
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        const sdpSpan = this.startSpan(
          "JSEP Event - Offer",
          { ...line },
          { ...event },
          "JSEP",
          session.traceId,
          session.sessionSpanId
        )
        sdpSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
      /*
        Local SDP
      */
      } else if (line.event.owner === "local") {
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        const sdpSpan = this.startSpan(
          "JSEP Event - Answer",
          { ...line },
          { ...event },
          "JSEP",
          session.traceId,
          session.sessionSpanId
        )
        sdpSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
      }
    /*
      Type 16 - WebRTC state event
      */
    } else if (line.type === 16) {
      // logger.info('EVENT -----------', line)
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
          timestamp: line.timestamp || this.nano_now(new Date().getTime())
        }
        if (line.event.ice === 'gathering') {
          let session = this.sessionMap.get(line.session_id)
          /* Capture Starts mid-Session */
          if (!session) {
            const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
            session = {
              session_id: line.session_id,
              lastEvent: Date.now().toString(),
              traceId: sessionSpan.traceId,
              sessionSpanId: sessionSpan.id,
              sessionSpan: sessionSpan,
              status: 'Open',
              transportId: line.event.transport?.id || 'undef'
            }
          }
          const iceSpan = this.startSpan(
            "ICE gathering",
            { ...line },
            { ...event },
            "ICE",
            session.traceId,
            session.sessionSpanId
          )
          session.iceSpanId = iceSpan.id
          session.iceSpan = iceSpan
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, { ...session })
        } else if (event.ice_state === 'connecting') {
          let session = this.sessionMap.get(line.session_id)
          /* Capture Starts mid-Session */
          if (!session) {
            const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
            session = {
              session_id: line.session_id,
              lastEvent: Date.now().toString(),
              traceId: sessionSpan.traceId,
              sessionSpanId: sessionSpan.id,
              sessionSpan: sessionSpan,
              status: 'Open',
              transportId: line.event.transport?.id || 'undef'
            }
          }
          const conIceSpan = this.startSpan(
            "ICE connecting",
            { ...line },
            { ...event },
            "ICE",
            session.traceId,
            session.iceSpanId || session.sessionSpanId
          )
          conIceSpan.end(session.lastEvent)
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, { ...session })
        } else if (line.event.ice === "connected") {
          let session = this.sessionMap.get(line.session_id)
          /* Capture Starts mid-Session */
          if (!session) {
            const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
            session = {
              session_id: line.session_id,
              lastEvent: Date.now().toString(),
              traceId: sessionSpan.traceId,
              sessionSpanId: sessionSpan.id,
              sessionSpan: sessionSpan,
              status: 'Open',
              transportId: line.event.transport?.id || 'undef'
            }
          }
          const conIceSpan = this.startSpan(
            "ICE connected",
            { ...line },
            { ...event },
            'ICE',
            session.traceId,
            session.iceSpanId || session.sessionSpanId
          )
          conIceSpan.end(session.lastEvent)
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, { ...session })
        } else if (line.event.ice === "ready") {
          let session = this.sessionMap.get(line.session_id)
          /* Capture Starts mid-Session */
          if (!session) {
            const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
            session = {
              session_id: line.session_id,
              lastEvent: Date.now().toString(),
              traceId: sessionSpan.traceId,
              sessionSpanId: sessionSpan.id,
              sessionSpan: sessionSpan,
              status: 'Open',
              transportId: line.event.transport?.id || 'undef'
            }
          }
          const readySpan = this.startSpan(
            "ICE ready",
            { ...line },
            { ...event },
            'ICE',
            session.traceId,
            session.iceSpanId || session.sessionSpanId
          )
          readySpan.end(session.lastEvent)
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, { ...session })
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
          timestamp: line.timestamp || this.nano_now(new Date().getTime())
        }
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        const candidateSpan = this.startSpan(
          "Local Candidate",
          { ...line },
          { ...event },
          'ICE',
          session.traceId,
          session.iceSpanId || session.sessionSpanId
        )
        candidateSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
      /*
        Subtype 3
        Remote Candidates
      */
      } else if (line.subtype === 3) {
        event = {
          eventName: "Remote Candidates",
          session_id: line?.session_id?.toString() || line?.session_id,
          candidate: line?.event["remote-candidate"],
          timestamp: line.timestamp || this.nano_now(new Date().getTime())
        }
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        const candidateSpan = this.startSpan(
          "Remote Candidate",
          { ...line },
          { ...event },
          'ICE',
          session.traceId,
          session.iceSpanId || session.sessionSpanId
        )
        candidateSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
      /*
        Subtype 4
        Connection Selected
      */
      } else if (line.subtype === 4) {
        event = {
          name: "Candidates selected",
          event: JSON.stringify(line?.event),
          session_id: line?.session_id?.toString() || line?.session_id,
          timestamp: line.timestamp || this.nano_now(new Date().getTime())
        }
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        const candidateSpan = this.startSpan(
          "Selected Candidates",
          { ...line },
          { ...event },
          'ICE',
          session.traceId,
          session.iceSpanId || session.sessionSpanId
        )
        candidateSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
      /*
        Subtype 5
        DTLS flow
      */
      } else if (line.subtype === 5) {
        event = {
          eventName: "DTLS flow",
          event: line?.event?.dtls,
          session_id: line?.session_id?.toString() || line?.session_id,
          timestamp: line.timestamp || this.nano_now(new Date().getTime())
        }
        /*
          trying
        */
        if (event.event === 'trying') {
          let session = this.sessionMap.get(line.session_id)
          /* Capture Starts mid-Session */
          if (!session) {
            const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
            session = {
              session_id: line.session_id,
              lastEvent: Date.now().toString(),
              traceId: sessionSpan.traceId,
              sessionSpanId: sessionSpan.id,
              sessionSpan: sessionSpan,
              status: 'Open',
              transportId: line.event.transport?.id || 'undef'
            }
          }
          const trySpan = this.startSpan(
            "DTLS trying",
            { ...line },
            { ...event },
            'ICE',
            session.traceId,
            session.iceSpanId || session.sessionSpanId
          )
          trySpan.end(session.lastEvent)
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, { ...session })
        /*
          connected
        */
        } else if (event.event === 'connected') {
          let session = this.sessionMap.get(line.session_id)
          /* Capture Starts mid-Session */
          if (!session) {
            const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
            session = {
              session_id: line.session_id,
              lastEvent: Date.now().toString(),
              traceId: sessionSpan.traceId,
              sessionSpanId: sessionSpan.id,
              sessionSpan: sessionSpan,
              status: 'Open',
              transportId: line.event.transport?.id || 'undef'
            }
          }
          const conSpan = this.startSpan(
            "DTLS connected",
            { ...line },
            { ...event },
            'ICE',
            session.traceId,
            session.iceSpanId || session.sessionSpanId
          )
          conSpan.end(session.lastEvent)
          session.lastEvent = Date.now().toString()
          this.sessionMap.set(line.session_id, { ...session })
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
          timestamp: line.timestamp || this.nano_now(new Date().getTime())
        }
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        const conSpan = this.startSpan(
          "WebRTC Connection UP",
          { ...line },
          { ...event },
          'ICE',
          session.traceId,
          session.iceSpanId || session.sessionSpanId
        )
        conSpan.end(session.lastEvent)
        try {
          session.iceSpan.end(session.lastEvent)
          if (this.filter.metrics) {
            let mediaMetrics = {
              streams: []
            }

            let timestamp = this.nano_now(Date.now()).toString().padEnd(19, '0')

            mediaMetrics.streams.push({
              stream: {
                emitter: line.emitter,
                type: '16',
                metric: "ice_duration"
              },
              values: [
                [
                  timestamp,
                  "emitter=" + line.emitter + " session_id=" + line.session_id.toString() + " name=" + "ice_duration" + " traceId=" + session.traceId + " value=" + session.iceSpan.duration,
                  session.iceSpan.duration
                ]
              ]
            })
            if (this.filter.debug) logger.info('type 16: ', mediaMetrics, JSON.stringify(mediaMetrics))
            if (this.filter.httpSending) {
              sender.host = this.filter.httpHost
              sender.sendMetrics(mediaMetrics)
            } else if (this.filter.kafkaSending) {
              this.filter.producer.send({
                topic: 'metrics',
                messages: [{
                  value: JSON.stringify(mediaMetrics)
                }]
              })
            }
            mediaMetrics = null
            timestamp = null
          }
          session.iceSpan = null
        } catch (e) {
          /* swallow error */
          if (this.filter.debug) logger.info(e)
        }
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
      }
    /*
      Type 32 - Media Report
    */
    } else if (line.type === 32) {
      if (this.filter.debug) logger.info('EVENT 32 -----------', line)
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
        timestamp: line.timestamp || this.nano_now(new Date().getTime())
      }

      if (line.event.media === "audio" && line.subtype === 3) {
        // logger.info('event ----', event)
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        let mediaSpan = this.startSpan(
          "Audio Media Report",
          { ...line },
          { ...event },
          'Media',
          session.traceId,
          session.sessionSpanId
        )
        mediaSpan.annotations = [
          {
            timestamp: this.nano_now(Date.now()),
            value: JSON.stringify(line.event)
          }
        ]
        /* Split out data and send to metrics counter */
        if (this.filter.metrics) {
          this.sendMetrics({
            session_id: line.session_id.toString(),
            emitter: line.emitter,
            media: line.event.media,
            traceId: session.traceId,
            metrics: line.event
          }, this.filter)
        }
        // logger.info('mediaSpan -----------', mediaSpan)
        mediaSpan.end(session.lastEvent, line.event['rtt'])
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
        session = null
        mediaSpan = null
      } else if (line.event.media === "video" && line.subtype === 3) {
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undefined'
          }
        }
        let mediaSpan = this.startSpan(
          "Video Media Report",
          { ...line },
          { ...event },
          'Media',
          session.traceId,
          session.sessionSpanId
        )
        mediaSpan.annotations = [
          {
            timestamp: this.nano_now(Date.now()),
            value: JSON.stringify(line.event)
          }
        ]
        /* Split out data and send to metrics counter */
        if (this.filter.metrics) {
          this.sendMetrics({
            session_id: line.session_id.toString(),
            emitter: line.emitter,
            media: line.event.media,
            traceId: session.traceId,
            metrics: line.event
          }, this.filter)
        }
        mediaSpan.end(session.lastEvent, line.event['rtt'])
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
        session = null
        mediaSpan = null
      }
    /*
      Type 128 - Transport-originated
      */
    } else if (line.type === 128) {
      // logger.info('Event ----', line)
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
        { ...line },
        { ...event },
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
        timestamp: line.timestamp || this.nano_now(new Date().getTime())
      }
      if (event.subtype === 1) {
        let serverSpan = this.startSpan(
          "Startup",
          { ...line },
          { ...event },
          'Core'
        )
        serverSpan.end()
        serverSpan = null
      } else if (event.subtype === 2) {
        let serverSpan = this.startSpan(
          "Shutdown",
          { ...line },
          { ...event },
          'Core'
        )
        serverSpan.end()
        serverSpan = null
      }

    /*
    TYPE 64 - Plugin-originated event

    Users Joining or Leaving Sessions
    */
    } else if (line.type === 64) {
      // logger.info('EVENT ----', line, line.event.data.event, line.event.data.name)
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
        timestamp: line.timestamp || this.nano_now(new Date().getTime())
      }
      if (!line.event.data) return
      /*
        Joined Event
        */
      if (line.event.data.event === 'joined') {
        let session = this.sessionMap.get(line.session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        let joinSpan = this.startSpan(
          "User",
          { ...line },
          { ...event },
          'Plugin',
          session.traceId,
          session.sessionSpanId
        )
        session.joinSpanId = joinSpan.id
        session.joinSpan = { ...joinSpan }
        let joinedSpan = this.startSpan(
          "User joined",
          { ...line },
          { ...event },
          'Plugin',
          session.traceId,
          session.joinSpanId || session.sessionSpanId
        )
        joinedSpan.end(session.lastEvent)
        session.eventId = line.event.data.id
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(line.session_id, { ...session })
        this.sessionMap.set(line.event.data.id, line.session_id)
        session = null
        joinSpan = null
        joinedSpan = null
        /*
        Configured Event
        */
      } else if (line.event.data.event === 'configured') {
        // logger.info('CONF', line, line.event.data.id, line?.session_id)
        let session_id = this.sessionMap.get(line.event.data.id)
        let session = this.sessionMap.get(session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        let confSpan = this.startSpan(
          "User configured",
          { ...line },
          { ...event },
          'Plugin',
          session.traceId,
          session.joinSpanId || session.sessionSpanId
        )
        session.confSpan = { ...confSpan }
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(session_id, { ...session })
        session_id = null
        session = null
        confSpan = null
        /*
        Published Event
        */
      } else if (line.event.data.event === 'published') {
        let session_id = this.sessionMap.get(line.event.data.id)
        let session = this.sessionMap.get(session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        let pubSpan = this.startSpan(
          "User published",
          { ...line },
          { ...event },
          'Plugin',
          session.traceId,
          session.joinSpanId || session.sessionSpanId
        )
        session.pubSpan = { ...pubSpan }
        try {
          session.confSpan.end(session.lastEvent)
          session.confSpan = null
        } catch (e) {
          /* swallow error */
          if (this.filter.debug) logger.info(e)
        }
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(session_id, { ...session })
        session_id = null
        session = null
        pubSpan = null
        /*
        Subscribing Event
        */
      } else if (line.event.data.event === 'subscribing') {
        let session_id = this.sessionMap.get(line.event.data.id)
        let session = this.sessionMap.get(session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        let subSpan = this.startSpan(
          "User subscribing",
          { ...line },
          { ...event },
          'Plugin',
          session.traceid,
          session.joinSpanId || session.sessionSpanId
        )
        session.subSpan = { ...subSpan }
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(session_id, { ...session })
        session_id = null
        session = null
        subSpan = null
        /*
        Subscribed Event
        */
      } else if (line.event.data.event === 'subscribed') {
        let session_id = this.sessionMap.get(line.event.data.id)
        let session = this.sessionMap.get(session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        try {
          session.subSpan.end(session.lastEvent)
          session.subSpan = null
        } catch (e) {
          /* swallow error */
          if (this.filter.debug) logger.info(e)
        }
        this.sessionMap.set(session_id, { ...session })
        session_id = null
        session = null
        /*
        Update Event
        */
      } else if (line.event.data.event === 'updated') {
        let session_id = this.sessionMap.get(line.event.data.id)
        let session = this.sessionMap.get(session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        let upSpan = this.startSpan(
          "User updated",
          { ...line },
          { ...event },
          'Plugin',
          session.traceId,
          session.joinSpanId || session.sessionSpanId
        )
        upSpan.end(session.lastEvent)
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(session_id, { ...session })
        session_id = null
        session = null
        upSpan = null
        /*
        Unpublished Event
        */
      } else if (line.event.data.event === 'unpublished') {
        let session_id = this.sessionMap.get(line.event.data.id)
        let session = this.sessionMap.get(session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        let unpubSpan = this.startSpan(
          "User unpublished",
          { ...line },
          { ...event },
          'Plugin',
          session.traceId,
          session.joinSpanId
        )
        unpubSpan.end(session.lastEvent)
        try {
          session.pubSpan.end(session.lastEvent)
          session.pubSpan = null
          session.pubSpan = {}
          session.pubSpan.end = () => {}
        } catch (e) {
          // swallow error
          if (this.filter.debug) logger.info(e)
        }
        session.lastEvent = Date.now().toString()
        this.sessionMap.set(session_id, { ...session })
        session_id = null
        session = null
        unpubSpan = null
        /*
        Leaving Event
        */
      } else if (line.event.data.event === 'leaving') {
        let session_id = this.sessionMap.get(line.event.data.id)
        let session = this.sessionMap.get(session_id)
        /* Capture Starts mid-Session */
        if (!session) {
          const sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session')
          session = {
            session_id: line.session_id,
            lastEvent: Date.now().toString(),
            traceId: sessionSpan.traceId,
            sessionSpanId: sessionSpan.id,
            sessionSpan: sessionSpan,
            status: 'Open',
            transportId: line.event.transport?.id || 'undef'
          }
        }
        try {
          let leaveSpan = this.startSpan(
            "User leaving",
            { ...line },
            { ...event },
            'Plugin',
            session.traceId,
            session.joinSpanId || session.sessionSpanId
          )
          leaveSpan.end(session.lastEvent)
          leaveSpan = null
          session.joinSpan.end(session.lastEvent)
          session.joinSpan = null
          session.joinSpan = {}
          session.joinSpan.end = () => {}
        } catch (e) {
          /* swallow error */
          if (this.filter.debug) logger.info(e)
        }
        session.lastEvent = Date.now().toString()
        session.status = 'Closed'
        this.sessionMap.set(session_id, { ...session })
        session_id = null
        session = null
      }
    }

    event = null
  }

  this.startSpan = function (name, line, event, service, traceId, parentId) {
    let span = {}
    let context = this
    span.id = this.generateSpanId()
    span.name = name
    span.tags = event
    span.attributes = event
    span.timestamp = this.nano_now(Date.now())
    span.localEndpoint = {
      serviceName: service
    }
    span['service.name'] = service
    span.kind = "SERVER"
    span.start = this.nano_now(Date.now())
    span.duration = 0
    span.end = function (lastEvent, duration) {
      // logger.info('SPAN ----', span)
      span.duration = context.nano_now(Date.now()) - span.start
      if (lastEvent) { span.tags.lastEvent = lastEvent }
      if (duration) { span.duration = duration * 1000 } // assuming rtt is in ms
      context.buffer.push({ ...span })
      span = null
      context = null
    }
    if (traceId) {
      span.traceId = traceId
    } else {
      span.traceId = this.generateTraceId()
    }
    if (parentId) {
      span.parentId = parentId
    }
    if (this.filter.debug) { logger.info('span ---', span) }
    return span
  }

  this.check = function () {
    // logger.info('this', this)
    let sinceLast = Date.now() - this.lastflush
    if (this.buffer.length > this.filter.bufferSize || (this.buffer.length > 0 && sinceLast > 10000)) {
      this.lastflush = Date.now()
      this.flush()
    }

    for (let entry of this.sessionMap.values()) {
      let session = entry
      // Check timeout of session
      // logger.info(session)
      if (!session.lastEvent) { return }
      if (this.filter.debug) logger.info(session.lastEvent, Date.now() - (new Date(parseInt(session.lastEvent))))
      try {
        if (Date.now() - (new Date(parseInt(session.lastEvent))) > (1000 * 2) && session.status === 'Closed') {
          if (this.filter.debug) logger.info('Deleting session from sessionMap, 2 sec timeout and closed')
          this.sessionMap.delete(session.session_id)
          this.sessionMap.delete(session?.eventId)
          session = null
          if (this.filter.debug) logger.info(`${this.sessionMap.size}, closed`)
        } else if (Date.now() - (new Date(parseInt(session.lastEvent))) > (1000 * 5 * 60)) {
          if (this.filter.debug) logger.info('Deleting session from sessionMap, older than 5 minutes')
          this.sessionMap.delete(session.session_id)
          this.sessionMap.delete(session?.eventId)
          session = null
          if (this.filter.debug) logger.info(`${this.sessionMap.size}, timedout`)
        }
      } catch (e) {
        // swallow e
        logger.info('sessionMap', e)
      }
      session = null
      entry = null
    }

    sinceLast = null
  }

  this.flush = async function () {
    // logger.info('flushing', this.buffer)
    let swap = [...this.buffer]
    if (this.filter.debug) logger.info('SWAP', swap)
    this.buffer = null
    this.buffer = []
    let string = JSON.stringify(swap)
    if (this.filter.debug) logger.info(string)
    if (this.filter.httpSending) {
      sender.host = this.filter.httpHost
      sender.sendSpans(swap)
    } else if (this.filter.kafkaSending) {
      let obj = {
        topic: 'tempo',
        messages: [{ value: string }]
      }
      this.filter.producer.send(obj)
      obj = null
    }
    swap = null
    string = null
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
    return parseInt(date.toString().padEnd(16, '0'))
  }

  this.sendMetrics = async function (event, self) {
    if (self.debug) logger.info('Event Metrics', event)

    let mediaMetrics = {
      streams: []
    }

    let timestamp = this.nano_now(Date.now()).toString().padEnd(19, '0')
    /* RTT or Round Trip Time Metric */
    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "rtt"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "rtt" + " traceId=" + event.traceId + " value=" + (event.metrics["rtt"] || 0),
          event.metrics["rtt"] || 0
        ]
      ]
    })

    /* Building a Histogram based on these metrics
        Buckets should be an even size, we are mostly interested and
        the Bucket 500 - 1000 as these would indicate higher than usual
        rss and would allow us to identify potentially bad connections

        Bucket Width should be 100 from 200 - 1500 / +Inf

        Buckets are less or equal to the Bucket upper bounds expressed
        below with <= upperBound
    */

    const rtt = parseInt(event.metrics["rtt"] || 0)

    if (!isNaN(rtt)) {
      self.histogram.labels(event.emitter, event.emitter, 'rtt').observe(rtt)
    }

    if (rtt <= 10) {
      mediaMetrics.streams.push({
        stream: {
          __name__: 'rtt_bucket',
          emitter: event.emitter,
          server: event.emitter,
          client: 'rtt',
          le: '10'
        },
        values: [
          [
            timestamp,
            "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "rtt" + " traceId=" + event.traceId + " value=" + (event.metrics["rtt"] || 0),
            event.metrics["rtt"] || 0
          ]
        ]
      })
    }

    if (rtt <= 200) {
      mediaMetrics.streams.push({
        stream: {
          __name__: 'rtt_bucket',
          emitter: event.emitter,
          server: event.emitter,
          client: 'rtt',
          le: '200'
        },
        values: [
          [
            timestamp,
            "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "rtt" + " traceId=" + event.traceId + " value=" + (event.metrics["rtt"] || 0),
            event.metrics["rtt"] || 0
          ]
        ]
      })
    }

    if (rtt <= 400) {
      mediaMetrics.streams.push({
        stream: {
          __name__: 'rtt_bucket',
          emitter: event.emitter,
          server: event.emitter,
          client: 'rtt',
          le: '400'
        },
        values: [
          [
            timestamp,
            "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "rtt" + " traceId=" + event.traceId + " value=" + (event.metrics["rtt"] || 0),
            event.metrics["rtt"] || 0
          ]
        ]
      })
    }

    if (rtt <= 700) {
      mediaMetrics.streams.push({
        stream: {
          __name__: 'rtt_bucket',
          emitter: event.emitter,
          server: event.emitter,
          client: 'rtt',
          le: '700'
        },
        values: [
          [
            timestamp,
            "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "rtt" + " traceId=" + event.traceId + " value=" + (event.metrics["rtt"] || 0),
            event.metrics["rtt"] || 0
          ]
        ]
      })
    }

    if (rtt <= 1500) {
      mediaMetrics.streams.push({
        stream: {
          __name__: 'rtt_bucket',
          emitter: event.emitter,
          server: event.emitter,
          client: 'rtt',
          le: '1500'
        },
        values: [
          [
            timestamp,
            "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "rtt" + " traceId=" + event.traceId + " value=" + (event.metrics["rtt"] || 0),
            event.metrics["rtt"] || 0
          ]
        ]
      })
    }

    /* infinity bucket */

    mediaMetrics.streams.push({
      stream: {
        __name__: 'rtt_bucket',
        emitter: event.emitter,
        server: event.emitter,
        client: 'rtt',
        le: '+Inf'
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "rtt" + " traceId=" + event.traceId + " value=" + (event.metrics["rtt"] || 0),
          event.metrics["rtt"] || 0
        ]
      ]
    })

    /* Lost Packets Locally Metric */

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "local_lost_packets"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "local_lost_packets" + " traceId=" + event.traceId + " value=" + (event.metrics["lost"] || 0),
          event.metrics["lost"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "remote_lost_packets"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "remote_lost_packets" + " traceId=" + event.traceId + " value=" + (event.metrics["lost-by-remote"] || 0),
          event.metrics["lost-by-remote"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "local_jitter"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "local_jitter" + " traceId=" + event.traceId + " value=" + (event.metrics["jitter-local"] || 0),
          event.metrics["jitter-local"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "remote_jitter"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "remote_jitter" + " traceId=" + event.traceId + " value=" + (event.metrics["jitter-remote"] || 0),
          event.metrics["jitter-remote"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "in_link_quality"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "in_link_quality" + " traceId=" + event.traceId + " value=" + (event.metrics["in-link-quality"] || 0),
          event.metrics["in-link-quality"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "in_media_link_quality"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "in_media_link_quality" + " traceId=" + event.traceId + " value=" + (event.metrics["in-media-link-quality"] || 0),
          event.metrics["in-media-link-quality"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "out_link_quality"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "out_link_quality " + " traceId=" + event.traceId + " value=" + (event.metrics["out-link-quality"] || 0),
          event.metrics["out-link-quality"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "out_media_link_quality"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "out_media_link_quality" + " traceId=" + event.traceId + " value=" + (event.metrics["out-media-link-quality"] || 0),
          event.metrics["out-media-link-quality"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "packets_received"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "packets_received" + " traceId=" + event.traceId + " value=" + (event.metrics["packets-received"] || 0),
          event.metrics["packets-received"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "packets_sent"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "packets_sent" + " traceId=" + event.traceId + " value=" + (event.metrics["packets-sent"] || 0),
          event.metrics["packets-sent"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "bytes_received"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "bytes_received" + " traceId=" + event.traceId + " value=" + (event.metrics["bytes-received"] || 0),
          event.metrics["bytes-received"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "bytes_sent"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "bytes_sent" + " traceId=" + event.traceId + " value=" + (event.metrics["bytes-sent"] || 0),
          event.metrics["bytes-sent"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "bytes_received_lastsec"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "bytes_received_lastsec" + " traceId=" + event.traceId + " value=" + (event.metrics["bytes-received-lastsec"] || 0),
          event.metrics["bytes-received-lastsec"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "bytes_sent_lastsec"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "bytes_sent_lastsec" + " traceId=" + event.traceId + " value=" + (event.metrics["bytes-sent-lastsec"] || 0),
          event.metrics["bytes-sent-lastsec"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "nacks_received"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "nacks_received" + " traceId=" + event.traceId + " value=" + (event.metrics["nacks-received"] || 0),
          event.metrics["nacks-received"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "nacks_sent"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "nacks_sent" + " traceId=" + event.traceId + " value=" + (event.metrics["nacks-sent"] || 0),
          event.metrics["nacks-sent"] || 0
        ]
      ]
    })

    mediaMetrics.streams.push({
      stream: {
        emitter: event.emitter,
        mediatype: event.media,
        type: '32',
        metric: "retransmission_received"
      },
      values: [
        [
          timestamp,
          "emitter=" + event.emitter + " session_id=" + event.session_id + " mediatype=" + event.media + " name=" + "retransmission_received" + " traceId=" + event.traceId + " value=" + (event.metrics["retransmission-received"] || 0),
          event.metrics["retransmission-received"] || 0
        ]
      ]
    })

    if (self.httpSending) {
      sender.host = self.httpHost
      sender.sendMetrics(mediaMetrics)
    } else if (self.kafkaSending) {
      self.producer.send({
        topic: 'metrics',
        messages: [{
          value: JSON.stringify(mediaMetrics)
        }]
      })
    }

    mediaMetrics = null
    timestamp = null

    return true
  }
}
