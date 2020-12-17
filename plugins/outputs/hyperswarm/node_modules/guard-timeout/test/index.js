'use strict'

const { promisify } = require('util')
const test = require('tape')
const guardTimeout = require('..')
const lag = require('atomic-sleep')

test('schedules a new timeout if timeout triggers after default lagMs time', ({ ok, end }) => {
  const start = Date.now()
  setTimeout(() => {
    const now = Date.now()
    const delta = now - start
    ok(delta >= 100)
    ok(delta < 2000)
  }, 100)
  guardTimeout(() => {
    const now = Date.now()
    const delta = now - start
    ok(delta >= 1100)
    end()
  }, 100)
  lag(1150)
})

test('create guardTimeout, custom lagMs', ({ ok, end }) => {
  const customguardTimeout = guardTimeout.create({ lagMs: 500 })
  const start = Date.now()
  setTimeout(() => {
    const now = Date.now()
    const delta = now - start
    ok(delta >= 100)
    ok(delta < 720)
  }, 100)
  customguardTimeout(() => {
    const now = Date.now()
    const delta = now - start
    ok(delta >= 600)
    ok(delta < 1000)
    end()
  }, 100)
  lag(600)
})

test('create guardTimeout, custom rescheduler', ({ ok, plan }) => {
  plan(5)
  const customguardTimeout = guardTimeout.create({
    lagMs: 500,
    rescheduler: (t, tInst) => {
      ok(tInst === instance)
      return t / 10
    }
  })
  const start = Date.now()
  setTimeout(() => {
    const now = Date.now()
    const delta = now - start
    ok(delta >= 100)
    ok(delta < 720)
  }, 100)
  const instance = customguardTimeout(() => {
    const now = Date.now()
    const delta = now - start
    ok(delta >= 150)
    ok(delta < 720)
  }, 100)
  lag(700)
})

test('close method', ({ ok, end, fail }) => {
  const start = Date.now()
  setTimeout(() => {
    const now = Date.now()
    const delta = now - start
    ok(delta >= 100)
    ok(delta < 2000)
    setTimeout(() => {
      instance.close()
    }, 0)
    setTimeout(end, 2000) // give safe timeout time to refire
  }, 100)
  const instance = guardTimeout(() => {
    fail('guardTimeout should not fire')
  }, 100)
  lag(1150)
})

test('promisified safe timeout', ({ ok, end }) => {
  const start = Date.now()
  setTimeout(() => {
    const now = Date.now()
    const delta = now - start
    ok(delta >= 100)
    ok(delta < 2000)
  }, 100)
  const safe = promisify(guardTimeout)
  const p = safe(100)
  p.then(() => {
    const now = Date.now()
    const delta = now - start
    ok(delta >= 1100)
    end()
  }, 100)
  lag(1150)
  setTimeout(() => {}, 200)
})
