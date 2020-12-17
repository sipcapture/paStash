const set = require('unordered-set')

module.exports = opts => new ShuffledPriorityQueue(opts)

class ShuffledPriorityQueue {
  constructor (opts) {
    this.priorities = []
    this.equals = (opts && opts.equals) || null
  }

  get length () {
    return this.priorities.reduce(add, 0)
  }

  [Symbol.iterator] () {
    return new Iterator(this)
  }

  head () {
    for (let i = this.priorities.length - 1; i >= 0; i--) {
      const q = this.priorities[i]
      if (q.length) return shuffle(q, 0)
    }
    return null
  }

  tail () {
    for (let i = 0; i < this.priorities.length; i++) {
      const q = this.priorities[i]
      if (q.length) return shuffle(q, 0)
    }
    return null
  }

  prev (prev) {
    if (!prev) return this.tail()
    return next(this.priorities, prev, 1)
  }

  next (prev) {
    if (!prev) return this.head()
    return next(this.priorities, prev, -1)
  }

  shift () {
    return this.remove(this.head())
  }

  pop () {
    return this.remove(this.tail())
  }

  add (val) {
    const prio = val.priority || 0
    while (prio >= this.priorities.length) this.priorities.push([])
    set.add(this.priorities[prio], val)
    return val
  }

  remove (val) {
    if (!val) return null

    if (val._index === undefined) {
      val = this.find(val)
      if (!val) return null
    }

    return set.remove(this.priorities[val.priority || 0], val)
  }

  has (val) {
    if (val._index === undefined) return this.find(val)
    const priority = val.priority || 0
    if (priority >= this.priorities.length) return false
    return set.has(this.priorities[priority], val)
  }

  find (val) {
    if (val._index !== undefined) return val

    const prio = val.priority || 0
    const qs = this.priorities
    if (prio >= qs.length) return null

    const q = qs[prio]

    for (let i = 0; i < q.length; i++) {
      if (this.equals(q[i], val)) return q[i]
    }

    return null
  }
}

class Iterator {
  constructor (queue) {
    this.prev = null
    this.queue = queue
  }

  next () {
    const next = this.queue.next(this.prev)
    this.prev = next
    return { done: !next, value: next }
  }
}

function shuffle (q, i) {
  const ran = i + Math.floor(Math.random() * (q.length - i))
  set.swap(q, q[ran], q[i])
  return q[i]
}

function next (queues, prev, inc) {
  let i = prev.priority || 0
  let j = (prev._index || 0) + 1

  while (true) {
    if (i < 0 || i >= queues.length) return null
    const q = queues[i]

    if (j >= q.length) {
      i += inc
      j = 0
      continue
    }

    return shuffle(q, j)
  }
}

function add (len, b) {
  return len + b.length
}
