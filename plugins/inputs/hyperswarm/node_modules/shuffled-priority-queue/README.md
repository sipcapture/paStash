# shuffled-priority-queue

A priority queue that shuffles elements with the same priority.

```
npm install shuffled-priority-queue
```

[![Build Status](https://travis-ci.org/mafintosh/shuffled-priority-queue.svg?branch=master)](https://travis-ci.org/mafintosh/shuffled-priority-queue)

## Usage

``` js
const spq = require('shuffled-priority-queue')
const queue = spq()

queue.add({
  priority: 0,
  value: 'hello'
})

queue.add({
  priority: 0,
  value: 'world'
})

queue.add({
  priority: 1,
  value: 'welt'
})

queue.add({
  priority: 2,
  value: 'verden'
})

console.log(queue.shift()) // returns {value: 'verden'}
console.log(queue.shift()) // returns {value: 'welt'}
console.log(queue.shift()) // returns {value: 'hello'} or {value: 'world'}
console.log(queue.shift()) // returns {value: 'hello'} or {value: 'world'}
console.log(queue.shift()) // returns null (empty queue)
```

## API

#### `const queue = spq()`

Create a new queue.

#### `value = queue.add(value)`

Add a new value to the queue. The value is returned for convenience
If you set `value.priority` to a number, it'll be added to the queue at that priority.

#### `queue.remove(value)`

Remove a value from the queue.

#### `bool = queue.has(value)`

Check if a value is in the queue.

#### `value = queue.shift()`

Shift the next value off the queue.

The value returned will have the highest priority off the queue.
If multiple values have the same priority a random one is returned.

#### `value = queue.head()`

Same as `shift()` but does not mutate the queue.

#### `value = queue.pop()`

Same as `shift()` but returns a value with the lowest priority.

#### `value = queue.tail()`

Same as `pop()` but does not mutate the queue.

#### `queue.length`

Property containing how many items are in the queue

#### `for (const value of queue)`

Iterate the queue from highest priority to lowest using the `for of` syntax

#### `value = queue.next([prevValue])`

Iterate the queue from highest priority to lowest.

``` js
let prevValue = null

while (prevValue = queue.next(prevValue)) {
  console.log('value:', prevValue)
}
```

#### `value = queue.prev([prevValue])`

Iterate the queue from lowest priority to highest.

``` js
let prevValue = null

while (prevValue = queue.prev(prevValue)) {
  console.log('value:', prevValue)
}
```

## License

MIT
