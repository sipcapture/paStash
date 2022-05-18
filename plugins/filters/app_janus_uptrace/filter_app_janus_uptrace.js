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
const { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } = require('@opentelemetry/core')
const { Resource } = require('@opentelemetry/resources')
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions')
const { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base')
const { CollectorTraceExporter } = require('@opentelemetry/exporter-collector')
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin')
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus')
const { MeterProvider } = require('@opentelemetry/sdk-metrics-base')
const { createClient, parseDsn } = require('@uptrace/core')
// const uptrace = require('@uptrace/node')

function nano_now (date) { return parseInt(date.toString().padEnd(16, '0')) }

function FilterAppJanusTracer () {
  base_filter.BaseFilter.call(this)
  this.mergeConfig({
    name: 'AppJanusTracer',
    optional_params: [
      'debug',
      'uptrace_dsn',
      'cloki_dsn',
      'bypass',
      'service_name',
      'filter',
      'metrics',
      'port',
      'interval'
    ],
    default_values: {
      'uptrace_dsn': 'http://token@uptrace.host.ip:14318/<project_id>',
      'cloki_dsn': 'http://127.0.0.1:3100/tempo/api/push',
      'service_name': 'pastash-janus',
      'bypass': true,
      'filter': ["1", "128", "2", "4", "8", "16", "32", "64", "256"],
      'metrics': false,
      'port': 9090,
      'interval': 10000,
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
    filterArray.push([parseInt(this.filter[i]), "allow"])
  }
  this.filterMap = new Map(filterArray)

  const dsn = parseDsn(this.uptrace_dsn)
  const _CLIENT = createClient(dsn)

  const provider = new BasicTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'pastash-janus'
    })
  })

  const exporter_UT = new CollectorTraceExporter({
    headers: {
      'uptrace-dsn': this.uptrace_dsn
    },
    url: `${dsn.otlpAddr()}/v1/traces`
  })

  const exporter_CL = new ZipkinExporter({
    headers: {
      'tracer': 'cloki'
    },
    url: this.cloki_dsn
  })

  provider.addSpanProcessor(new BatchSpanProcessor(exporter_UT, {
    maxExportBatchSize: 1000,
    maxQueueSize: 1000,
    scheduledDelayMillis: 5 * 1000
  }))
  provider.addSpanProcessor(new BatchSpanProcessor(exporter_CL, {
    maxExportBatchSize: 1000,
    maxQueueSize: 1000
  }))

  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))

  provider.register({
    contextManager: otel.contextManager,
    propagator: new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()]
    })
  })

  if (this.metrics) {
    // Initialize Service
    const options = { port: this.port, startServer: true }
    const exporter = new PrometheusExporter(options)

    // Register the exporter
    /*
    this.meter = new MeterProvider({
      exporter: exporter,
      interval: this.interval,
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'janus-metrics'
      })
    }).getMeter('janus-metrics') */
    this.metricsProvider = new MeterProvider({ interval: this.interval })
    this.metricsProvider.addMetricReader(exporter)
    this.meter = this.metricsProvider.getMeter('janus-metrics')
    this.counters = {}

    // Register counters
    this.counters['s'] = this.meter.createUpDownCounter('sessions', {
      description: 'Session Counters'
    })
    this.counters['u'] = this.meter.createUpDownCounter('events', {
      description: 'User Counters'
    })
    this.counters['ml'] = this.meter.createUpDownCounter('lost_packets', {
      description: 'Lost Packets Local'
    })
    this.counters['mlr'] = this.meter.createUpDownCounter('lost_packets_remote', {
      description: 'Lost Packets Remote'
    })
    this.counters['jl'] = this.meter.createUpDownCounter('jitter_local', {
      description: 'Jitter Local'
    })
    this.counters['jlr'] = this.meter.createUpDownCounter('jitter_remote', {
      description: 'Jitter Remote'
    })
    this.counters['ilq'] = this.meter.createUpDownCounter('in_link_quality', {
      description: 'In Link Quality'
    })
    this.counters['imlq'] = this.meter.createUpDownCounter('in_media_link_quality', {
      description: 'In Media Link Quality'
    })
    this.counters['olq'] = this.meter.createUpDownCounter('out_link_quality', {
      description: 'Out Link Quality'
    })
    this.counters['omlq'] = this.meter.createUpDownCounter('out_media_link_quality', {
      description: 'Out Media Link Quality'
    })

    logger.info('Initialized Janus Prometheus Exporter :' + this.port + '/metrics')
  }

  callback()
}

FilterAppJanusTracer.prototype.process = async function (data) {
  /* check if we already have a global tracer */
  var tracer
  if (this.lru.has('tracer_instance')) {
    /* if yes, return current tracer */
    tracer = this.lru.get('tracer_instance')
  } else {
    /* if not, create a new tracer */
    tracer = otel.trace.getTracer('pastash_janus_uptrace', 'v0.1.0')
    this.lru.set('tracer_instance', tracer)
  }

  // logger.info('PJU -- Tracer tracking event', this.lru.has('tracer_instance'))

  // bypass
  if (this.bypass) this.emit('output', data)
  if (!data.message) return
  var event = {}
  var line = JSON.parse(data.message)
  logger.info('Incoming line', line.type, line.event)
  /* Ignore all other events */
  if (!this.filterMap.has(line.type)) return
  logger.info('Filtered', line.type, line.session_id, line.handle_id)
  /*
  TYPE 1 - Session related event
  Create Session and Destroy Session events are traced
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
      sessionSpan.resource.attributes['service.name'] = 'Session'
      // logger.info('PJU -- Session event:', sessionSpan)
      this.lru.set("sess_" + event.session_id, sessionSpan)
      if (this.metrics) this.counters['s'].add(1, event)
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
      if (this.metrics) this.counters['s'].add(-1, event)
      destroySpan.end()
      sessionSpan.end()
      this.lru.delete("sess_" + event.session_id)
    }
  /*
  TYPE 2 - Handle related event
  Handle Attachment and Detachment is traced
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
    Type 4 - External event
    */
  } else if (line.type == 4) {
    event = {
      name: "External Event",
      event: "External Event",
      session_id: line?.session_id?.toString() || line?.session_id,
      id: line?.session_id,
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }
    const sessionSpan = this.lru.get("sess_" + event.session_id)
    const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
    const extSpan = tracer.startSpan("External Event", {
      attributes: event,
      kind: otel.SpanKind.SERVER
    }, ctx)
    extSpan.setAttribute('service.name', 'External')
    extSpan.end()
  /*
    Type 8 - JSEP event
    */
  } else if (line.type == 8) {
    event = {
      name: line?.event?.jsep?.type,
      event: line?.event?.owner,
      session_id: line?.session_id?.toString() || line?.session_id,
      sdp: line?.event?.jsep?.sdp || 'null',
      id: line?.session_id,
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }
    logger.info("TYPE 8 EVENT", event.event)
    /*
      Remote SDP
    */
    if (event.name == "offer") {
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const sdpSpan = tracer.startSpan("JSEP Event - Offer", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      sdpSpan.setAttribute('service.name', 'JSEP')
      this.lru.set("sdp_" + event.session_id, sdpSpan)
    /*
      Local SDP
    */
    } else if (event.event == "local") {
      const offerSpan = this.lru.get("sdp_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), offerSpan)
      const sdpSpan = tracer.startSpan("JSEP Event - Answer", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      sdpSpan.setAttribute('service.name', 'JSEP')
      sdpSpan.end()
      offerSpan.end()
    }
  /*
    Type 16 - WebRTC state event
    */
  } else if (line.type == 16) {
    logger.info("TYPE 16", line)
    /*
      Subtype 1
      ICE flow
    */
    if (line.subtype == 1) {
      event = {
        name: "Ice Flow",
        type: line.type,
        subtype: line.subtype,
        event: line?.event?.ice,
        session_id: line?.session_id?.toString() || line?.session_id,
        ice_state: line?.event?.ice || 'null',
        id: line?.session_id,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      if (event.ice_state == "gathering") {
        const sessionSpan = this.lru.get("sess_" + event.session_id)
        const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
        const iceSpan = tracer.startSpan("ICE gathering", {
          attributes: event,
          kind: otel.SpanKind.SERVER
        }, ctx)
        iceSpan.setAttribute('service.name', 'ICE')
        this.lru.set("ice_" + event.session_id, iceSpan)

      } else if (event.ice_state == "connecting") {
        const iceSpan = this.lru.get("ice_" + event.session_id)
        const ctx = otel.trace.setSpan(otel.context.active(), iceSpan)
        const conIceSpan = tracer.startSpan("ICE connecting", {
          attributes: event,
          kind: otel.SpanKind.SERVER
        }, ctx)
        conIceSpan.setAttribute('service.name', 'ICE')
        conIceSpan.end()

      } else if (event.ice_state == "connected") {
        const iceSpan = this.lru.get("ice_" + event.session_id)
        const ctx = otel.trace.setSpan(otel.context.active(), iceSpan)
        const conIceSpan = tracer.startSpan("ICE connected", {
          attributes: event,
          kind: otel.SpanKind.SERVER
        }, ctx)
        conIceSpan.setAttribute('service.name', 'ICE')
        conIceSpan.end()

      } else if (event.ice_state == "ready") {
        const iceSpan = this.lru.get("ice_" + event.session_id)
        const ctx = otel.trace.setSpan(otel.context.active(), iceSpan)
        const readySpan = tracer.startSpan("ICE ready", {
          attributes: event,
          kind: otel.SpanKind.SERVER
        }, ctx)
        readySpan.setAttribute('service.name', 'ICE')
        readySpan.end()
        iceSpan.end()
      }
    /*
      Subtype 2
      Local Candidates
    */
    } else if (line.subtype == 2) {
      event = {
        name: "Local Candidates",
        type: line.type,
        subtype: line.subtype,
        session_id: line?.session_id?.toString() || line?.session_id,
        candidate: line?.event["local-candidate"],
        id: line?.session_id,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      const iceSpan = this.lru.get("ice_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), iceSpan)
      const candidateSpan = tracer.startSpan("Local Candidate", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      candidateSpan.setAttribute('service.name', 'ICE')
      candidateSpan.end()

    /*
      Subtype 3
      Remote Candidates
    */
    } else if (line.subtype == 3) {
      event = {
        name: "Remote Candidates",
        session_id: line?.session_id?.toString() || line?.session_id,
        candidate: line?.event["remote-candidate"],
        id: line?.session_id,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      const iceSpan = this.lru.get("ice_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), iceSpan)
      const candidateSpan = tracer.startSpan("Remote Candidate", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      candidateSpan.setAttribute('service.name', 'ICE')
      candidateSpan.end()
    /*
      Subtype 4
      Connection Selected
    */
    } else if (line.subtype == 4) {
      event = {
        name: "Candidates selected",
        event: JSON.stringify(line?.event),
        session_id: line?.session_id?.toString() || line?.session_id,
        id: line?.session_id,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      const iceSpan = this.lru.get("ice_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), iceSpan)
      const candidateSpan = tracer.startSpan("Selected Candidates", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      candidateSpan.setAttribute('service.name', 'ICE')
      candidateSpan.end()

    /*
      Subtype 5
      DTLS flow
    */
    } else if (line.subtype == 5) {
      event = {
        name: "DTLS flow",
        event: line?.event?.dtls,
        session_id: line?.session_id?.toString() || line?.session_id,
        id: line?.session_id,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      /*
        trying
      */
      if (event.event == "trying") {
        const iceSpan = this.lru.get("ice_" + event.session_id)
        const ctx = otel.trace.setSpan(otel.context.active(), iceSpan)
        const trySpan = tracer.startSpan("DTLS trying", {
          attributes: event,
          kind: otel.SpanKind.SERVER
        }, ctx)
        trySpan.setAttribute('service.name', 'ICE')
        trySpan.end()
      /*
        connected
      */
      } else if (event.event == "connected") {
        const iceSpan = this.lru.get("ice_" + event.session_id)
        const ctx = otel.trace.setSpan(otel.context.active(), iceSpan)
        const conSpan = tracer.startSpan("DTLS connected", {
          attributes: event,
          kind: otel.SpanKind.SERVER
        }, ctx)
        conSpan.setAttribute('service.name', 'ICE')
        conSpan.end()
      }
    /*
      Subtype 6
      Connection Up
    */
    } else if (line.subtype == 6) {
      event = {
        name: "Connection Up",
        event: line?.event,
        session_id: line?.session_id?.toString() || line?.session_id,
        id: line?.session_id,
        timestamp: line.timestamp || nano_now(new Date().getTime())
      }
      const iceSpan = this.lru.get("ice_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), iceSpan)
      const conSpan = tracer.startSpan("WebRTC Connection UP", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      conSpan.setAttribute('service.name', 'ICE')
      conSpan.end()
    }
  /*
    Type 32 - Media Report
  */
  } else if (line.type == 32) {
    event = {
      name: "Media Reporting",
      type: line.type,
      subtype: line.subtype,
      media: line.event.media,
      event: line.event,
      session_id: line?.session_id?.toString() || line.session_id,
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }

    if (event.media === "audio" && event.subtype == 3) {
      event = Object.assign(event, line?.event)
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const mediaSpan = tracer.startSpan("Audio Media Report", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      mediaSpan.setAttribute('service.name', 'Media')
      mediaSpan.end()
      /* Split out data and send to metrics counter */
      if (this.metrics) {
        /*
        Missing metrics:
        "packets-received":4735,
        "packets-sent":0,
        "bytes-received":720937,
        "bytes-sent":0,
        "bytes-received-lastsec":9727,
        "bytes-sent-lastsec":0,
        "nacks-received":0,
        "nacks-sent":0,
        "retransmissions-received":0
        */
        this.counters['ml'].add(event.event["lost"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['mlr'].add(event.event["lost-by-remote"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['jl'].add(event.event["jitter-local"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['jlr'].add(event.event["jitter-remote"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['ilq'].add(event.event["in-link-quality"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['imlq'].add(event.event["in-media-link-quality"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['olq'].add(event.event["out-link-quality"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['omlq'].add(event.event["out-media-link-quality"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
      }
    } else if (event.media === "video" && event.subtype == 3) {
      event = Object.assign(event, line?.event)
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const mediaSpan = tracer.startSpan("Video Media Report", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      mediaSpan.setAttribute('service.name', 'Media')
      mediaSpan.end()
      /* Split out data and send to metrics counter */
      if (this.metrics) {
        this.counters['ml'].add(event.event["lost"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['mlr'].add(event.event["lost-by-remote"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['jl'].add(event.event["jitter-local"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['jlr'].add(event.event["jitter-remote"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['ilq'].add(event.event["in-link-quality"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['imlq'].add(event.event["in-media-link-quality"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['olq'].add(event.event["out-link-quality"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
        this.counters['omlq'].add(event.event["out-media-link-quality"], { type: event.media, session_id: event.session_id, timestamp: event.timestamp })
      }
    }
  /*
    Type 128 - Transport-originated
    */
  } else if (line.type == 128) {
    /* Todo linked to session creation event via transport.id */
  /*
    Type 256 - Core event
    */
  } else if (line.type == 256) {
    event = {
      name: "Status Event",
      server: line.emitter,
      subtype: line.subtype,
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }
    if (event.subtype == 1) {
      const serverSpan = tracer.startSpan("Startup", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      })
      serverSpan.setAttribute('service.name', 'Core')
      serverSpan.end()
    } else if (event.subtype == 2) {
      const serverSpan = tracer.startSpan("Shutdown", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      })
      serverSpan.setAttribute('service.name', 'Core')
      serverSpan.end()
    }

  /*
  TYPE 64 - Plugin-originated event

  Users Joining or Leaving Sessions
  */
  } else if (line.type == 64) {
    event = {
      name: line.event.plugin,
      event: line.event.data.event,
      display: line.event.data?.display || 'null',
      id: line.event.data.id?.toString() || line.event.data.id,
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
      if (this.metrics) this.counters['u'].add(1, event)
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
      if (this.metrics) this.counters['u'].add(-1, event)
    }
  }
}

exports.create = function () {
  return new FilterAppJanusTracer()
}

/* promise wrapper */
