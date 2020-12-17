const spq = require('./')
const tape = require('tape')

tape('different prios', function (t) {
  const queue = spq()

  const a = queue.add({
    hello: 'world',
    priority: 0
  })

  const b = queue.add({
    hej: 'verden',
    priority: 1
  })

  t.ok(queue.has(b))
  t.same(queue.length, 2)
  t.same(queue.shift(), b)
  t.ok(!queue.has(b))
  t.same(queue.length, 1)
  t.same(queue.shift(), a)
  t.same(queue.length, 0)
  t.same(queue.shift(), null)
  t.end()
})

tape('same prios', function (t) {
  const queue = spq()

  const a = queue.add({
    hello: 'world',
    priority: 0
  })

  const b = queue.add({
    hello: 'verden',
    priority: 0
  })

  const c = queue.add({
    hej: 'verden',
    priority: 1
  })

  t.same(queue.shift(), c)

  let head = queue.shift()
  t.ok(head === a || head === b)

  head = queue.shift()
  t.ok(head === a || head === b)

  t.same(queue.shift(), null)
  t.end()
})

tape('next', function (t) {
  const queue = spq()

  const a = queue.add({
    hello: 'world',
    priority: 0
  })

  const b = queue.add({
    hello: 'verden',
    priority: 0
  })

  const c = queue.add({
    hej: 'verden',
    priority: 1
  })

  t.same(queue.next(), c)

  let value = queue.next(c)
  t.ok(value === a || value === b)

  const old = value
  value = queue.next(value)
  t.ok(old !== value)
  t.ok(value === a || value === b)

  t.same(queue.next(value), null)
  t.end()
})

tape('prev', function (t) {
  const queue = spq()

  const a = queue.add({
    hello: 'world',
    priority: 0
  })

  const b = queue.add({
    hello: 'verden',
    priority: 0
  })

  const c = queue.add({
    hej: 'verden',
    priority: 1
  })

  let tail = queue.prev()
  t.ok(tail === a || tail === b)

  const old = tail
  tail = queue.prev(tail)
  t.ok(old !== tail)
  t.ok(tail === a || tail === b)

  tail = queue.prev(tail)
  t.same(tail, c)

  t.same(queue.prev(tail), null)
  t.end()
})

tape('equals', function (t) {
  const queue = spq({
    equals: function (a, b) {
      return a.hello === b.hello
    }
  })

  queue.add({
    hello: 'world'
  })

  t.same(queue.head().hello, 'world')

  queue.remove({
    hello: 'world'
  })

  t.same(queue.head(), null)
  t.end()
})

tape('iterator', function (t) {
  t.plan(5)

  const queue = spq()
  const seen = {}

  queue.add({ priority: 0, hi: 'a' })
  queue.add({ priority: 0, hi: 'b' })
  queue.add({ priority: 1, hi: 'c' })
  queue.add({ priority: 2, hi: 'd' })

  let prev = 3

  for (const value of queue) {
    t.ok(prev >= value.priority)
    prev = value.priority
    seen[value.hi] = true
  }

  t.same(seen, { a: true, b: true, c: true, d: true })
})
