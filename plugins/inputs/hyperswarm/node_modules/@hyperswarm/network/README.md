# @hyperswarm/network

The low level networking guts of the Hyperswarm stack.

```
npm install @hyperswarm/network
```

## Usage

``` js
const network = require('@hyperswarm/network')()

const nw = network()

nw.bind(function () {
  // topic should be a 32 byte buffer
  nw.lookupOne(topic, function (err, peer) {
    if (err) throw err
    nw.connect(peer, function (err, socket) {
      if (err) throw err
      socket.write('Hello World!')
    })
  })
})
```

## API

#### `net = network([options])`

Create a new network instance.

Options include:

``` js
{
  bind () {
    // called when the network is bound
  },
  close () {
    // called when the network is fully closed
  },
  socket (socket) {
    // called when an incoming socket is received
  },
  // Optionally overwrite the default set of bootstrap servers
  bootstrap: [addresses],
  // Set to false if this is a long running instance on a server
  // When running in ephemeral mode you don't join the DHT but just 
  // query it instead. If unset, or set to a non-boolean (default undefined)
  // then the node will start in short-lived (ephemeral) mode and switch 
  // to long-lived (non-ephemeral) mode after a certain period of uptime
  ephemeral: undefined
}
```

#### `nw.bind([preferredPort], [callback])`

Bind to a preferred port. Must be called before connecting.

Safe to call multiple times. If already bound or binding it will call
the callback when fully bound.

#### `nw.close([callback])`

Fully close the network.

Safe to call multiple times.

#### `nw.connect(peer, callback)`

Connect to a peer. Will do UDP holepunching.

Callback is called with `(err, socket, isTCP)`. If the underlying socket is a TCP socket `isTCP` will be true, if it is a UTP socket it will be false.

#### `announcer = nw.announce(topic)`

Start announcing the network on the Hyperswarm discovery network.

#### `lookup = nw.lookup(topic)`

Start doing a lookup on the Hyperswarm discovery network.

#### `nw.lookupOne(topic, callback)`

Lookup a single peer on the Hyperswarm discovery network.

## License

MIT
