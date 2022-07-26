const axios = require('axios')
const { logger } = require('@pastash/pastash')

const debug = false
let metricsToSend = []
let spansToSend = []
const onMetrics = []
const onSpans = []
const httpThroughputMetrics = [0, 0, 0, 0, 0]
let sendingQueueLength = 0
let sendingErrors = 0
let gaveUp = 0
let retransmissions = 0

function fireMetrics () {
  metricsToSend.length && onMetrics.length && onMetrics.pop()()
}

function fireSpans () {
  spansToSend.length && onSpans.length && onSpans.pop()()
}

function sendMetrics (obj, retries) {
  retries = retries || 0
  metricsToSend.push({ retries, payload: obj })
  fireMetrics()
}

function sendSpans (obj, retries) {
  retries = retries || 0
  spansToSend.push({ retries, payload: obj })
  fireSpans()
}

async function startMetricsSender () {
  while (true) {
    if (!metricsToSend.length) {
      await new Promise((resolve, reject) => onMetrics.push(resolve))
    }
    let toSend = ['{"streams":[']
    let len = 14
    let i = 0
    metricsToSend = metricsToSend.filter(m => m.payload)
    for (; i < metricsToSend.length && len < 20 * 1024 * 1024; i++) {
      if (i > 0) {
        toSend.push(',')
      }
      let str = JSON.stringify(metricsToSend[i].payload.streams)
      str = str.substring(1, str.length - 1)
      toSend.push(str)
      len += str.length
    }
    toSend.push(']}')
    let sending = metricsToSend.slice(0, i)
    metricsToSend = metricsToSend.slice(i)
    fireMetrics()
    const body = toSend.join('')
    toSend = null
    const sendingLength = sending.length
    sendingQueueLength += sendingLength
    sending = sending.filter(s => s.retries < 4)
    const givingUp = sendingLength - sending.length
    try {
      var response = await axios.post(`${module.exports.host}/loki/api/v1/push`, body, {
        maxBodyLength: 50 * 1024 * 1024,
        maxContentLength: 50 * 1024 * 1024,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      if (debug) logger.debug('Metrics posted', response.status, response.statusText)
    } catch (e) {
      sendingErrors += sendingLength
      if (e instanceof axios.AxiosError) {
        logger.error(`HTTP ERROR '${e.message}' [${e.response?.status}]: ${e.response?.data}`)
      } else {
        logger.error(e)
      }
      gaveUp += givingUp
      setTimeout(() => {
        metricsToSend.push.apply(metricsToSend,
          sending.map(s => ({ ...s, retries: s.retries + 1 })))
        fireMetrics()
        retransmissions += sending.length
      }, 10000)
    } finally {
      sendingQueueLength -= sendingLength
      httpThroughputMetrics[Math.floor(Date.now() / 1000) % 5] += body.length
    }
    await new Promise((resolve, reject) => setTimeout(resolve, 100))
  }
}

async function startSpansSender () {
  while (true) {
    if (!spansToSend.length) {
      await new Promise((resolve, reject) => onSpans.push(resolve))
    }
    let toSend = ['[']
    let len = 2
    let i = 0
    spansToSend = spansToSend.filter(m => m.payload)
    for (; i < spansToSend.length && len < 20 * 1024 * 1024; i++) {
      if (i > 0) {
        toSend.push(',')
      }
      let str = JSON.stringify(spansToSend[i].payload)
      if (!str) {
        continue
      }
      str = str.substring(1, str.length - 1)
      toSend.push(str)
      len += str.length
    }
    toSend.push(']')
    let sending = spansToSend.slice(0, i)
    spansToSend = spansToSend.slice(i)
    fireSpans()
    const body = toSend.join('')
    toSend = null
    const sendingLength = sending.length
    sendingQueueLength += sendingLength
    sending = sending.filter(s => s.retries < 4)
    const givingUp = sendingLength - sending.length
    try {
      var response = await axios.post(`${module.exports.host}/tempo/spans`, body, {
        maxBodyLength: 50 * 1024 * 1024,
        maxContentLength: 50 * 1024 * 1024,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      if (debug) logger.debug('Spans posted', response.status, response.statusText)
    } catch (e) {
      sendingErrors += sendingLength
      if (e instanceof axios.AxiosError) {
        logger.error(`HTTP ERROR '${e.message}' [${e.response?.status}]: ${e.response?.data}`)
      } else {
        logger.error(e)
      }
      gaveUp += givingUp
      setTimeout(() => {
        spansToSend.push.apply(spansToSend,
          sending.filter(s => s.retries < 4).map(s => ({ ...s, retries: s.retries + 1 })))
        fireSpans()
        retransmissions += sending.length
      }, 10000)
    } finally {
      sendingQueueLength -= sendingLength
      httpThroughputMetrics[Math.floor(Date.now() / 1000) % 5] += body.length
    }
    await new Promise((resolve, reject) => setTimeout(resolve, 100))
  }
}

for (let i = 0; i < 10; i++) {
  startMetricsSender()
  startSpansSender()
}

if (debug) {
  (() => {
    let lastReport = Date.now()
    setInterval(() => {
      if (Date.now() - lastReport >= 5000) {
        const avgThroughput = httpThroughputMetrics.reduce((sum, a) => sum + a, 0) / 5 / 1024 / 1024
        logger.info(`input_queue=${metricsToSend.length + spansToSend.length} ` +
                  `errors=${sendingErrors} currently_sending=${sendingQueueLength} ` +
                  `retransmitted_requests=${retransmissions} failed_requests=${gaveUp} ` +
                  `avg_5s_throughput=${avgThroughput}MB/s`)
        lastReport = Date.now()
      }
      httpThroughputMetrics[(Math.floor(Date.now() / 1000) + 1) % 5] = 0
    }, 1000)
  })()
}

module.exports = {
  sendMetrics,
  sendSpans,
  host: ''
}
