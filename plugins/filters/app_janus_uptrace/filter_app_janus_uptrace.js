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
const { createClient, parseDsn } = require('@uptrace/core')
const axios = require('axios')

function nano_now (date) { return parseInt(date.toString().padEnd(16, '0')) }

function FilterAppJanusTracer () {
  base_filter.BaseFilter.call(this)
  this.mergeConfig({
    name: 'AppJanusTracer',
    optional_params: [
      'debug',
      'uptrace_dsn',
      'uptrace_host',
      'bypass',
      'service_name',
      'filter',
      'metrics',
      'project_id',
      'interval'
    ],
    default_values: {
      'uptrace_host': 'http://platform.uptrace.dev',
      'uptrace_dsn': 'http://token@uptrace.dev',
      'service_name': 'pastash-janus',
      'bypass': true,
      'filter': ["1", "128", "2", "4", "8", "16", "32", "64", "256"],
      'metrics': false,
      'project_id': '/1',
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
    url: `${this.uptrace_host}/v1/traces`
  })

  const exporter_CL = new ZipkinExporter({
    headers: {
      'tracer': 'cloki',
      'uptrace-dsn': this.uptrace_dsn
    },
    url: `${this.uptrace_host}/api/v2/spans`
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
    logger.info('Metrics enabled for Media Reports')
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
  if (this.bypass) {
    this.emit('output', data)
  } else {
    // TODO emit logs directly into uptrace logging
    var log = JSON.parse(data.message)
    var msg = {
      streams: [
        {
          stream: {
            type: log.type,
            subtype: log?.subtype,
            emitter: log.emitter
          },
          values: [
            [(Date.now() * 1000000).toString(), JSON.stringify(log)]
          ]
        }
      ]
    }
    postData(JSON.stringify(msg), this)
  }
  if (!data.message) return
  var event = {}
  var line = JSON.parse(data.message)
  // logger.info('Incoming line', line.type, line.event)
  /* Ignore all other events */
  if (!this.filterMap.has(line.type)) return
  // logger.info('Filtered', line.type, line.session_id, line.handle_id)
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
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const createdSpan = tracer.startSpan("Session Created", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      createdSpan.setAttribute('service.name', 'Session')
      createdSpan.end()
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
      const attachedSpan = tracer.startSpan("Handle", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      attachedSpan.setAttribute('service.name', 'Handle')
      this.lru.set("att_" + event.session_id, attachedSpan)
      const createdSpan = tracer.startSpan("Handle attached", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      createdSpan.setAttribute('service.name', 'Handle')
      createdSpan.end()
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
    // logger.info("TYPE 8 EVENT", event.event)
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
      sdpSpan.end()
    /*
      Local SDP
    */
    } else if (event.event == "local") {
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      const sdpSpan = tracer.startSpan("JSEP Event - Answer", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      sdpSpan.setAttribute('service.name', 'JSEP')
      sdpSpan.end()
    }
  /*
    Type 16 - WebRTC state event
    */
  } else if (line.type == 16) {
    // logger.info("TYPE 16", line)
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
      name: "Media Report",
      type: line.type,
      subtype: line.subtype,
      media: line.event.media,
      emitter: line?.emitter,
      event: line.event,
      session_id: line?.session_id?.toString() || line.session_id,
      timestamp: line.timestamp || nano_now(new Date().getTime())
    }

    if (event.media === "audio" && event.subtype == 3) {
      event = Object.assign(event, line?.event)
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      event.traceId = sessionSpan._spanContext.traceId
      const mediaSpan = tracer.startSpan("Audio Media Report", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      mediaSpan.setAttribute('service.name', 'Media')
      mediaSpan.end()
      /* Split out data and send to metrics counter */
      if (this.metrics) {
        sendMetrics(event, this)
      }
    } else if (event.media === "video" && event.subtype == 3) {
      event = Object.assign(event, line?.event)
      const sessionSpan = this.lru.get("sess_" + event.session_id)
      const ctx = otel.trace.setSpan(otel.context.active(), sessionSpan)
      event.traceId = sessionSpan._spanContext.traceId
      const mediaSpan = tracer.startSpan("Video Media Report", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      mediaSpan.setAttribute('service.name', 'Media')
      mediaSpan.end()
      /* Split out data and send to metrics counter */
      if (this.metrics) {
        sendMetrics(event, this)
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
      const joinSpan = tracer.startSpan("User", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      joinSpan.setAttribute('service.name', 'Plugin')
      this.lru.set("join_" + event.id, joinSpan)
      const createdSpan = tracer.startSpan("User joined", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      createdSpan.setAttribute('service.name', 'Plugin')
      createdSpan.end()
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
      const pubSpan = tracer.startSpan("User Media Published", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      pubSpan.setAttribute('service.name', 'Plugin')
      this.lru.set("pub_" + event.id, pubSpan)

      const confSpan = this.lru.get('conf_' + event.id)
      confSpan.end()

      const createdSpan = tracer.startSpan("User published", {
        attributes: event,
        kind: otel.SpanKind.SERVER
      }, ctx)
      createdSpan.setAttribute('service.name', 'Plugin')
      createdSpan.end()
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
      if (pubSpan) {
        pubSpan.end()
      }
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
        if (joinSpan) {
          joinSpan.end()
        }
      } catch (e) {
        console.log(e)
      }
    }
  }
}

exports.create = function () {
  return new FilterAppJanusTracer()
}

/* Metrics Sender to cloki */

function sendMetrics (event, self) {
  // logger.info('Event Metrics', event)

  const mediaMetrics = {
    streams: []
  }

  const timestamp = (Date.now() * 1000000).toString()

  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "local_lost_packets"
    },
    values: [
      [
        timestamp,
        `local_lost_packets session_id=${event.session_id} traceid=${event.traceId} value=${event.event["lost"]}`,
        event.event["lost"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "remote_lost_packets"
    },
    values: [
      [
        timestamp,
        `remote_lost_packets session_id=${event.session_id} traceid=${event.traceId} value=${event.event["lost-by-remote"]}`,
        event.event["lost-by-remote"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "local_jitter"
    },
    values: [
      [
        timestamp,
        `local_jitter session_id=${event.session_id} traceid=${event.traceId} value=${event.event["jitter-local"]}`,
        event.event["jitter-local"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "remote_jitter"
    },
    values: [
      [
        timestamp,
        `remote_jitter session_id=${event.session_id} traceid=${event.traceId} value=${event.event["jitter-remote"]}`,
        event.event["jitter-remote"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "in_link_quality"
    },
    values: [
      [
        timestamp,
        `in_link_quality session_id=${event.session_id} traceid=${event.traceId} value=${event.event["in-link-quality"]}`,
        event.event["in-link-quality"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "in_media_link_quality"
    },
    values: [
      [
        timestamp,
        `in_media_link_quality session_id=${event.session_id} traceid=${event.traceId} value=${event.event["in-media-link-quality"]}`,
        event.event["in-media-link-quality"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "out_link_quality"
    },
    values: [
      [
        timestamp,
        `out_link_quality session_id=${event.session_id} traceid=${event.traceId} value=${event.event["out-link-quality"]}`,
        event.event["out-link-quality"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "out_media_link_quality"
    },
    values: [
      [
        timestamp,
        `out_media_link_quality session_id=${event.session_id} traceid=${event.traceId} value=${event.event["out-media-link-quality"]}`,
        event.event["out-media-link-quality"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "packets_received"
    },
    values: [
      [
        timestamp,
        `packets_received session_id=${event.session_id} traceid=${event.traceId} value=${event.event["packets-received"]}`,
        event.event["packets-received"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "packets_sent"
    },
    values: [
      [
        timestamp,
        `packets_sent session_id=${event.session_id} traceid=${event.traceId} value=${event.event["packets-sent"]}`,
        event.event["packets-sent"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "bytes_received"
    },
    values: [
      [
        timestamp,
        `bytes_received session_id=${event.session_id} traceid=${event.traceId} value=${event.event["bytes-received"]}`,
        event.event["bytes-received"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "bytes_sent"
    },
    values: [
      [
        timestamp,
        `bytes_sent session_id=${event.session_id} traceid=${event.traceId} value=${event.event["bytes-sent"]}`,
        event.event["bytes-sent"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "bytes_received_lastsec"
    },
    values: [
      [
        timestamp,
        `bytes_received_lastsec session_id=${event.session_id} traceid=${event.traceId} value=${event.event["bytes-received-lastsec"]}`,
        event.event["bytes-received-lastsec"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "bytes_sent_lastsec"
    },
    values: [
      [
        timestamp,
        `bytes_sent_lastsec session_id=${event.session_id} traceid=${event.traceId} value=${event.event["bytes-sent-lastsec"]}`,
        event.event["bytes-sent-lastsec"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "nacks_received"
    },
    values: [
      [
        timestamp,
        `nacks_received session_id=${event.session_id} traceid=${event.traceId} value=${event.event["nacks-received"]}`,
        event.event["nacks-received"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "nacks_sent"
    },
    values: [
      [
        timestamp,
        `nacks_sent session_id=${event.session_id} traceid=${event.traceId} value=${event.event["nacks-sent"]}`,
        event.event["nacks-sent"]
      ]
    ]
  })
  mediaMetrics.streams.push({
    stream: {
      emitter: event.emitter,
      mediatype: event.media,
      type: 32,
      metric: "retransmission_received"
    },
    values: [
      [
        timestamp,
        `retransmission_received session_id=${event.session_id} traceid=${event.traceId} value=${event.event["retransmission-received"]}`,
        event.event["retransmission-received"]
      ]
    ]
  })

  postData(JSON.stringify(mediaMetrics), self)
}

async function postData (data, self) {
  try {
    var response = await axios.post(self.uptrace_host + self.project_id + '/loki/api/v1/push', data, {
      headers: {
        'Content-Type': 'application/json',
        'uptrace-dsn': self.uptrace_dsn
      }
    })
    // logger.info('AXIOS Metrics send', response.status, response.statusText)
  } catch (err) {
    logger.info('ERROR AXIOS Metrics send', err)
  }
}
