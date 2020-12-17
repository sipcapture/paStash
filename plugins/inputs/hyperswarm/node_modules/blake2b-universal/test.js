const tape = require('tape')
const blake2b = require('./')
const browserBlake2b = require('./browser')

tape('basic', function (t) {
  const a = Buffer.alloc(32)
  const b = Buffer.alloc(32)

  blake2b(a, Buffer.from('hi'))
  blake2b(b, Buffer.from('hi'))

  t.same(a, b)

  b.fill(0)
  browserBlake2b(b, Buffer.from('hi'))

  t.same(a, b)

  t.end()
})

tape('batch', function (t) {
  const a = Buffer.alloc(32)
  const b = Buffer.alloc(32)

  blake2b.batch(a, [Buffer.from('hi'), Buffer.from('ho')])
  blake2b.batch(b, [Buffer.from('hi'), Buffer.from('ho')])

  t.same(a, b)

  b.fill(0)
  browserBlake2b.batch(b, [Buffer.from('hi'), Buffer.from('ho')])

  t.same(a, b)

  t.end()
})
