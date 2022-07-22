const axios = require('axios')
const {logger} = require("@pastash/pastash");

let metricsToSend = []
let spansToSend = []
let onMetrics = []
let onSpans = []

function fireMetrics() {
    metricsToSend.length && onMetrics.length && onMetrics.pop()()
}

function fireSpans() {
    spansToSend.length && onSpans.length && onSpans.pop()()
}

function sendMetrics(obj, retries) {
    retries = retries || 0
    metricsToSend.push({retries, payload: obj})
    fireMetrics()
}

function sendSpans(obj, retries) {
    retries = retries || 0
    spansToSend.push({retries, payload: obj})
    fireSpans()
}

async function startMetricsSender () {
    while (true) {
        if (!metricsToSend.length) {
            await new Promise(f => onMetrics.push(f))
        }
        const toSend = ['{"streams":[']
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
        const sending = metricsToSend.slice(0, i)
        metricsToSend = metricsToSend.slice(i)
        fireMetrics()
        try {
            var response = await axios.post(`${module.exports.host}/loki/api/v1/push`, toSend.join(''), {
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            logger.debug('Metrics posted', response.status, response.statusText)
        } catch (e) {
            if (e instanceof axios.AxiosError) {
                logger.error(`HTTP ERROR '${e.message}' [${e.response?.status}]: ${e.response?.data}`)
            } else {
                logger.error(e)
            }
            setTimeout(() => {
                metricsToSend.push.apply(metricsToSend,
                    sending.filter(s => s.retries < 4).map(s => ({...s, retries: s.retries + 1})))
                fireMetrics()
            }, 10000)
        }
        await new Promise(f => setTimeout(f, 100))
    }
}

async function startSpansSender () {
    while (true) {
        if (!spansToSend.length) {
            await new Promise(f => onSpans.push(f))
        }
        const toSend = ['[']
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
        const sending = spansToSend.slice(0, i)
        spansToSend = spansToSend.slice(i)
        fireSpans()
        try {
            var response = await axios.post(`${module.exports.host}/tempo/spans`, toSend.join(''), {
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            logger.debug('Spans posted', response.status, response.statusText)
        } catch (e) {
            if (e instanceof axios.AxiosError) {
                logger.error(`HTTP ERROR '${e.message}' [${e.response?.status}]: ${e.response?.data}`)
            } else {
                logger.error(e)
            }
            setTimeout(() => {
                spansToSend.push.apply(spansToSend,
                    sending.filter(s => s.retries < 4).map(s => ({...s, retries: s.retries + 1})))
                fireSpans()
            }, 10000)
        }
        await new Promise(f => setTimeout(f, 100))
    }
}

for (let i = 0; i < 10; i++) {
    startMetricsSender()
    startSpansSender()
}

module.exports = {
    sendMetrics,
    sendSpans,
    host: ''
}