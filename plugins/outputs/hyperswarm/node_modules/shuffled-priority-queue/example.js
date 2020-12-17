var spq = require('./')
var queue = spq()

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

console.log(queue.pop()) // returns {value: 'verden'}
console.log(queue.pop()) // returns {value: 'welt'}
console.log(queue.pop()) // returns {value: 'hello'} or {value: 'world'}
console.log(queue.pop()) // returns {value: 'hello'} or {value: 'world'}
console.log(queue.pop()) // returns null (empty queue)
