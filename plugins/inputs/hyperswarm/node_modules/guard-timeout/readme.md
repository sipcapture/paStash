# guard-timeout

> Guard against sleep mode timeouts firing on wake

## About

If a process goes into a sleep mode (for instance a laptop hibernates, or a service is put into inspect mode) then timeouts may trigger on wake. Depending on your use case (think distributed systems) you might not want to trigger a timeout if process uptime hasn't actually occurred in that period. 

The `guard-timeout` module will check if there is a significant lag (default 1s) between when the timeout 
was scheduled to fire and when it actually fired. 


## Install

```sh
$ npm i guard-timeout
```

## Usage

```js
const setTimeout = require('guard-timeout')

// if the timeout is 1 second late, 
// it will be reschedule for another 20 minutes

setTimeout(
  () => { console.log('do something') }, 
  1.2e+6 // 20 minutes
)
```

## Advanced Usage

Configure your own safe timeout: 

```js
const setTimeout = require('guard-timeout').create({
  lagMs: 60 * 1000 // 1 minute lag
})

// if the timeout is 1 minute late, 
// it will be reschedule for another 20 minutes

setTimeout(
  () => { console.log('do something') }, 
  1.2e+6 // 20 minutes
)
```

## Await Usage

`guard-timeout` has [`util.promisify`](https://nodejs.org/dist/latest-v8.x/docs/api/util.html#util_util_promisify_original) support: 

```js
const { promisify } = require('util')
const timeout = promisify(require('guard-timeout'))

async function run () {
  // if the timeout is 1 second late, 
  // it will be reschedule for another 20 minutes
  await timeout(1.2e+6) // 20 minutes
  console.log('do something')
}

run().catch(console.error)
```

## API

### `require('guard-timeout') => setTimeout (cb, time, ...args) => instance`

The default export of `guard-timeout` a is safe `setTimeout` function with a 
default `lagMs` option of 1000 (one second).

### `require('guard-timeout').create(opts) => setTimeout (cb, time, ...args) => instance`

Create a custom safe `setTimeout` function by passing in options

### `instance.close()`

Clears the timeout

### `instance.timeout`

A getter property which holds current underlying timeout object (or numerical ID in the browser).



#### Options

*  `lagMs` – `Number`, default: 1000. The allowable delta between when a timeout should fire and when it actually fires, in milliseconds. If this is exceeded then the timeout is rescheduled.
* `rescheduler` - `Function`, default: `(t, instance) => t`. A mapping function to calculate when the timeout should be rescheduled for. It takes two args, the time that the timeout was scheduled for and the timeout instance returned from `guard-timeout` (which comes Node's native `setTimeout`). The `instance` argument can be used to apply specific reschedule times to specific timeouts. The return value should be a number representing milliseconds for the rescheduled timeout. 


## Contributing

Pull requests and stars are always welcome. For bugs and feature requests, [please create an issue](https://github.com/David%20Mark%20Clements/guard-timeout/issues)

## Author

**David Mark Clements**

* [github/davidmarkclements](https://github.com/davidmarkclements)
* [twitter/davidmarkclem](http://twitter.com/davidmarkclem)

## License

Copyright © 2020 David Mark Clements
Licensed under the MIT license.
