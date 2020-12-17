'use strict'
const customPromisify = require('util').promisify.custom
const maxInt = Math.pow(2, 31) - 1

const defaults = {
  lagMs: 1000,
  rescheduler: (t) => t
}

function createSafeTimeout (opts = {}) {
  const { lagMs, rescheduler } = { ...defaults, ...opts }
  if (lagMs > maxInt) {
    throw Error('guard-timeout: lagMs must be (significantly) less than maxInt')
  }
  if (typeof rescheduler !== 'function') {
    throw Error('guard-timeout: rescheduler must be a function')
  }
  function guardTimeout (fn, t, ...args) {
    const gaurdTime = t + lagMs
    let maxLag = Date.now() + gaurdTime
    let timeout = setTimeout(handler, t, ...args)

    function handler (args = []) {
      if (Date.now() > maxLag) {
        maxLag = Date.now() + gaurdTime
        const rescheduledTime = rescheduler(t, instance)
        timeout = setTimeout(handler, rescheduledTime, ...args)
        return
      }
      fn(...args)
    }

    const instance = {
      get timeout () { return timeout },
      close () {
        clearTimeout(this.timeout)
      }
    }

    return instance
  }

  guardTimeout[customPromisify] = (t) => {
    let r = null
    const timeout = guardTimeout(() => {
      r()
    }, t)
    const promise = new Promise((resolve) => {
      r = resolve
      return timeout
    })
    promise.timeout = timeout
    return promise
  }

  return guardTimeout
}

const guardTimeout = createSafeTimeout()
guardTimeout.create = createSafeTimeout

module.exports = guardTimeout
