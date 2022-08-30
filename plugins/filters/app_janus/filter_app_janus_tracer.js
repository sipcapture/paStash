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
  /* Context Manager setup */
  this.ctx = new ContextManager(this, this.tracerName, this.lru)
  this.ctx.init()
  logger.info('Initialized App Janus Span + Metrics Tracer');
  sender.init(this)
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
    Stateless span creation on events
    One parent generated from session_id
    All other items have no parent-child relation,
    only service name unites them

    - Session_id is hash input

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
      line.event.transport.id
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
        let sessionSpan = this.startSpan('Session', { ...line }, { ...event }, 'Session', true)
        let sessionCreateSpan = this.startSpan(
          'Session Created',
          { ...line },
          { ...event },
          'Session'
        )
        sessionCreateSpan.end()
        sessionSpan.end()
        sessionCreateSpan = null
        sessionSpan = null
        // logger.info('PJU -- Session event:', sessionSpan, session)
      /* DESTROY event */
      } else if (line.event.name === 'destroyed') {
        /* Termination of a session that was already in place */
        let destroySpan = this.startSpan(
          'Session destroyed',
          { ...line },
          { ...event },
          'Session'
        )
        destroySpan.end()
        destroySpan = null
      }
    event = null
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
        let attachedSpan = this.startSpan(
          "Handle attached",
          { ...line },
          { ...event },
          'Handle'
        )
        attachedSpan.end()
        attachedSpan = null
        /*
        Detach Event
        */
      } else if (line.event.name === 'detached') {
        let detachedSpan = this.startSpan(
          "Handle detached",
          { ...line },
          { ...event },
          'Handle'
        )
        detachedSpan.end()
        detachedSpan = null
      }
    event = null
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
      let extSpan = this.startSpan(
        "External Event",
        { ...line },
        { ...event },
        "External"
      )
      extSpan.end()
      extSpan = null
    event = null
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
        let sdpSpan = this.startSpan(
          "JSEP Event - Offer",
          { ...line },
          { ...event },
          "JSEP"
        )
        sdpSpan.end()
        sdpSpan = null
      /*
        Local SDP
      */
      } else if (line.event.owner === "local") {
        let sdpSpan = this.startSpan(
          "JSEP Event - Answer",
          { ...line },
          { ...event },
          "JSEP"
        )
        sdpSpan.end()
        sdpSpan = null
      }
    event = null
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
          let iceSpan = this.startSpan(
            "ICE gathering",
            { ...line },
            { ...event },
            "ICE"
          )
          iceSpan.end()
          iceSpan = null
        } else if (event.ice_state === 'connecting') {
          let conIceSpan = this.startSpan(
            "ICE connecting",
            { ...line },
            { ...event },
            "ICE"
          )
          conIceSpan.end()
          conIceSpan = null
        } else if (line.event.ice === "connected") {
          let conIceSpan = this.startSpan(
            "ICE connected",
            { ...line },
            { ...event },
            'ICE'
          )
          conIceSpan.end()
          conIceSpan = null
        } else if (line.event.ice === "ready") {
          let readySpan = this.startSpan(
            "ICE ready",
            { ...line },
            { ...event },
            'ICE'
          )
          readySpan.end()
          readySpan = null
        }
      event = null
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
        let candidateSpan = this.startSpan(
          "Local Candidate",
          { ...line },
          { ...event },
          'ICE'
        )
        candidateSpan.end()
        candidateSpan = null
      event = null
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
        let candidateSpan = this.startSpan(
          "Remote Candidate",
          { ...line },
          { ...event },
          'ICE'
        )
        candidateSpan.end()
        candidateSpan = null
      event = null
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
        let candidateSpan = this.startSpan(
          "Selected Candidates",
          { ...line },
          { ...event },
          'ICE'
        )
        candidateSpan.end()
        candidateSpan = null
      event = null
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
          let trySpan = this.startSpan(
            "DTLS trying",
            { ...line },
            { ...event },
            'ICE'
          )
          trySpan.end()
          trySpan = null
        /*
          connected
        */
        } else if (event.event === 'connected') {
          let conSpan = this.startSpan(
            "DTLS connected",
            { ...line },
            { ...event },
            'ICE'
          )
          conSpan.end()
          conSpan = null
        }
      event = null
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
        let conSpan = this.startSpan(
          "WebRTC Connection UP",
          { ...line },
          { ...event },
          'ICE'
        )
        conSpan.end()
        conSpan = null
      event = null
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
        /* Split out data and send to metrics counter */
        if (this.filter.metrics) {
          this.sendMetrics({
            session_id: line.session_id.toString(),
            emitter: line.emitter,
            media: line.event.media,
            traceId: this.generateTraceId(line.session_id.toString()),
            metrics: line.event
          }, this.filter)
        }
      } else if (line.event.media === "video" && line.subtype === 3) {
        /* Split out data and send to metrics counter */
        if (this.filter.metrics) {
          this.sendMetrics({
            session_id: line.session_id.toString(),
            emitter: line.emitter,
            media: line.event.media,
            traceId: this.generateTraceId(line.session_id.toString()),
            metrics: line.event
          }, this.filter)
        }
      }
    event = null
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
      event = {
        name: line?.event?.data?.event,
        adminApi: line?.event?.data?.admin_api,
        ip: line?.event?.data?.ip,
        transportId: line?.event?.id,
        emitter: line?.emitter,
        transport: line?.event?.transport,
        session_id: (Math.random() * 1000000).toString(),
        type: line?.type,
        timestamp: line?.timestamp
      }
      let transportSpan = this.startSpan(
        "Transport connected",
        { ...line },
        { ...event },
        "Transport Originated"
      )
      transportSpan.end()
      transportSpan = null
    event = null
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
    event = null
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
        eventName: line?.event?.plugin,
        event: line?.event?.data?.event,
        display: line?.event?.data?.display || 'null',
        id: line.event.data.id?.toString() || line.event.data.id,
        session_id: line?.session_id?.toString() || line.session_id || line.event.data?.id.toString(),
        room: line.event?.data?.room?.toString() || line.event?.data?.room,
        timestamp: line.timestamp || this.nano_now(new Date().getTime())
      }
      if (!line.event.data) return
      /*
        Joined Event
        */
      if (line.event.data.event === 'joined') {
        let joinedSpan = this.startSpan(
          "User joined",
          { ...line },
          { ...event },
          'Plugin'
        )
        joinedSpan.end()
        joinedSpan = null
        /*
        Configured Event
        */
      } else if (line.event.data.event === 'configured') {
        // logger.info('CONF', line, line.event.data.id, line?.session_id)
        /* Capture Starts mid-Session */
        let confSpan = this.startSpan(
          "User configured",
          { ...line },
          { ...event },
          'Plugin'
        )
        confSpan.end()
        confSpan = null
        /*
        Published Event
        */
      } else if (line.event.data.event === 'published') {
        /* Capture Starts mid-Session */
        let pubSpan = this.startSpan(
          "User published",
          { ...line },
          { ...event },
          'Plugin'
        )
        pubSpan.end()
        pubSpan = null
        /*
        Subscribing Event
        */
      } else if (line.event.data.event === 'subscribing') {
        let subSpan = this.startSpan(
          "User subscribing",
          { ...line },
          { ...event },
          'Plugin'
        )
        subSpan.end()
        subSpan = null
        /*
        Subscribed Event
        */
      } else if (line.event.data.event === 'subscribed') {
        let subdSpan = this.startSpan(
          "User subscribed",
          { ...line },
          { ...event },
          'Plugin'
        )
        subdSpan.end()
        subdSpan = null
        /*
        Update Event
        */
      } else if (line.event.data.event === 'updated') {
        let upSpan = this.startSpan(
          "User updated",
          { ...line },
          { ...event },
          'Plugin'
        )
        upSpan.end()
        upSpan = null
        /*
        Unpublished Event
        */
      } else if (line.event.data.event === 'unpublished') {
        let unpubSpan = this.startSpan(
          "User unpublished",
          { ...line },
          { ...event },
          'Plugin'
        )
        unpubSpan.end()
        unpubSpan = null
        /*
        Leaving Event
        */
      } else if (line.event.data.event === 'leaving') {
        try {
          let leaveSpan = this.startSpan(
            "User leaving",
            { ...line },
            { ...event },
            'Plugin'
          )
          leaveSpan.end()
          leaveSpan = null
        } catch (e) {
          /* swallow error */
          if (this.filter.debug) logger.info(e)
        }
      }
      event = null
    }
    event = null
  }

  this.startSpan = function (name, line, event, service, parent) {
    let span = {}
    let context = this
    if (parent) {
      span.id = this.generateParentSpanId(event.session_id)
    } else {
      span.id = this.generateSpanId()
      span.parentId = this.generateParentSpanId(event.session_id)
    }
    span.traceId = this.generateTraceId(event.session_id)
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

  this.generateTraceId = function (session_id) {
    const hash = crypto.createHash('md5', { outputLength: 16 })
    hash.update(session_id.toString(), 'utf-8')
    return hash.digest('hex')
  }

  this.generateSpanId = function () {
    const buffer = new ArrayBuffer(8)
    const view = new Int8Array(buffer)
    const random = crypto.randomFillSync(view)
    return this.bufferToHex(random)
  }

  this.generateParentSpanId = function (session_id) {
    const hash = crypto.createHash('shake256', { outputLength: 8 })
    hash.update(session_id.toString(), 'utf-8')
    return hash.digest('hex')
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

    const rtt = event.metrics["rtt"] || 0

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

    /* Lost Packets Locally Metric on Server Side */

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

    /* Lost Packets Remote Metric on Client Side */

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
