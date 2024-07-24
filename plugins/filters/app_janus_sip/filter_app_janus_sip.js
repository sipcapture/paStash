/* Janus Event Tracer (C) 2022 QXIP BV */

/* eslint-disable camelcase */
/* eslint-disable semi */
/* eslint quotes: 0 */
/* eslint-disable quote-props */
/* eslint-disable dot-notation */


'use strict';

const base_filter = require('@pastash/pastash').base_filter
const util = require('util')
const { LRUCache } = require('lru-cache')
const parsip = require('parsip');  // SIP Parser
const logger = require('@pastash/pastash').logger


function FilterAppJanusTracer () {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppJanusTracer',
    optional_params: [
      'debug',
    ],
    default_values: {
      'debug': false,
    },
    start_hook: this.start.bind(this)
  })
  this.cache = {}
}

util.inherits(FilterAppJanusTracer, base_filter.BaseFilter);

FilterAppJanusTracer.prototype.start = async function (callback) {
  this.cache = new LRUCache({max: 500})
  callback();
};

FilterAppJanusTracer.prototype.process = function (data) {
  data = data.message.toString();
  if (this.debug) console.log('⚚ JANUS EVENT RECEIVED: ', data)
  try {
    data = JSON.parse(data)
  } catch (err) {
    if (this.debug) console.log('Received a bad line, ignored with err: ', err)
    return
  }
  if (data.type == 128) {
    if (this.debug) console.log('🔌 Websocket Event Received: ', data.event.data.event, data.event.data.ip, data.event.id)
    if (data.event.data.event === 'connected') {
      const websocketId = data.event.id
      const websocketIp = data.event.data.ip
      this.cache.set(websocketId, { id: websocketId, ip: websocketIp })
    }
  } else if (data.type == 1) {
    if (this.debug) console.log('🗞️ Session Data Received: ', data.event.name, data.event?.transport?.id, data.session_id)
    if (data.event?.transport?.id) {
      const websocketIp = this.cache.get(data.event.transport.id).ip
      const sessionData = {
        id: data.session_id,
        ip: websocketIp
      };
      this.cache.set(data.session_id, sessionData)
    }
  } else if (data.event.data?.sip) {
    if (this.debug) console.log('🕻 Checking SIP for Session ID', data.session_id, this.cache.has(data.session_id))
    /* Check if data has a session id */
    if (data.session_id) {
      /**
       * @property {object} sip Object containing SIP 
       * @property {string} sip.method SIP Method
       * @property {string} sip.data Raw SIP Message
       * @property {object} sip.via Via Object
       * @property {string} sip.via.protocol
       * @property {string} sip.via.transport
       * @property {string} sip.via.host_type
       * @property {string} sip.via.host
       * @property {integer} sip.via.port
       * @property {object} sip.from
       * @property {object} sip.to
       * @property {string} sip.call_id
       * @property {integer} sip.cseq
       * @property {string} sip.body
       */
      let sip = parsip.getSIP(data.event.data.sip)
      if (this.debug) console.log('-> Method', sip.method)
      if (this.debug) console.log('-> Call ID', sip.call_id)
      if (this.debug) console.log('-> Via Host and Port', sip.via.host, sip.via.port)
      if (this.debug) console.log('-> Via', sip.via)
      /**
       * @prop {string} ip - IP of Websocket Client
       * @prop {string} id - ID of Websocket
       * @prop {integer} port - Port of Websocket Client
       */
      let sessionData = {}
      if (this.cache.has(data.session_id)) {
      /* Get the session data from cache */
        sessionData = this.cache.get(data.session_id)
        if (this.debug) console.log('🗞️ Found Session Data: ', sessionData)
      } else {
        let ip = sip.via.host
        let port = sip.via.port
        sessionData = {ip, port, id: '0'}
        if (this.debug) console.log('🗞️ Infered Session Data from Via Header: ', sessionData)
        console.log('set', sessionData)
        this.cache.set(data.session_id, sessionData)
      }
      let rcinfo = {}
      if (this.debug) console.log('📢 Event Data received: ', data.event.data.event)

      /* If else for data.event.data.event */
      if (data.event.data.event === 'sip-out') {
        if (this.debug) console.log('⚚==> Plugin Sending SIP to Janus')
        rcinfo = {
          type: 'HEP',
          version: 3,
          payload_type: 1,
          ip_family: 2,
          protocol: 17,
          proto_type: 1,
          correlation_id: sip.call_id,
          srcIp: sessionData.ip || '127.0.0.1',
          srcPort: sessionData.port || 5050,
          dstIp: sip.via?.host || '127.0.0.1',
          dstPort: sip.via?.port || 5050,
          time_sec: Math.floor(data.timestamp / 1000000),
          time_usec: Math.floor((data.timestamp / 1000) % 1000),
        }
      } else if (data.event.data.event === 'sip-in') {
        if (this.debug) console.log('⚚<== Janus sending SIP to Plugin')
        rcinfo = {
          type: 'HEP',
          version: 3,
          payload_type: 1,
          ip_family: 2,
          protocol: 17,
          proto_type: 1,
          correlation_id: sip.call_id || '',
          srcIp: sip.via?.host || '127.0.0.1',
          srcPort: sip.via?.port || 5050,
          dstIp: sessionData.ip,
          dstPort: sip.via?.rport || 5050,
          time_sec: Math.floor(data.timestamp / 1000000),
          time_usec: Math.floor((data.timestamp / 1000) % 1000),
        }
      }
      if (this.debug) console.log('ℹ️ SIP Assembled RC INFO', rcinfo)

      this.emit('output', {rcinfo, payload: data.event.data.sip})
    }
  }
}

exports.create = function () {

  return new FilterAppJanusTracer();
};


