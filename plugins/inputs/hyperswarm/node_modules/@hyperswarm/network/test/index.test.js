'use strict'
const { randomBytes } = require('crypto')
const { promisify } = require('util')
const {
  promisifyApi,
  compatifyTcp,
  when,
  validSocket,
  dhtBootstrap
} = require('./util')
const { createServer } = require('net')
const dgram = require('dgram')
const once = require('events.once')
const getPort = require('get-port')
const { test } = require('tap')
const network = require('..')

test('network bound – bind option', async ({ pass, plan }) => {
  plan(1)
  const nw = promisifyApi(network({
    bind () { pass('method called') }
  }))
  await nw.bind()
  await nw.close()
})

test('custom dht – bootstrap option', async ({ is, pass }) => {
  const { bootstrap, closeDht, port } = await dhtBootstrap()
  const nw = promisifyApi(network({
    bootstrap,
    bind () {
      pass('bind method triggered')
    }
  }))
  await nw.bind()
  is(nw.discovery.dht.bootstrapNodes.length, 1)
  is(nw.discovery.dht.bootstrapNodes[0].port, port)
  await nw.close()
  closeDht()
})

test('setting ephemerality – ephemeral option', async ({ is, pass }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const defaultEphemerality = promisifyApi(network({
    bootstrap
  }))
  await defaultEphemerality.bind()
  is(defaultEphemerality.discovery.dht.ephemeral, true)
  await defaultEphemerality.close()
  const explicitlyEphemeral = promisifyApi(network({
    ephemeral: true,
    bootstrap
  }))
  await explicitlyEphemeral.bind()
  is(explicitlyEphemeral.discovery.dht.ephemeral, true)
  await explicitlyEphemeral.close()
  const nonEphemeral = promisifyApi(network({
    ephemeral: false,
    bootstrap
  }))
  await nonEphemeral.bind()
  is(nonEphemeral.discovery.dht.ephemeral, false)
  await nonEphemeral.close()
  closeDht()
})

test('network closed – close option', async ({ pass, plan }) => {
  plan(1)
  const nw = promisifyApi(network({
    close () { pass('method called') }
  }))
  await nw.bind()
  await nw.close()
})

test('announce before bind will throw', async ({ throws }) => {
  const nw = network()
  const topic = randomBytes(32)
  throws(() => nw.announce(topic), Error('Bind before announcing'))
})

test('lookupOne before bind will throw', async ({ throws }) => {
  const nw = network()
  const topic = randomBytes(32)
  throws(() => nw.lookupOne(topic), Error('Bind before doing a lookup'))
})

test('lookup before bind will throw', async ({ throws }) => {
  const nw = network()
  const topic = randomBytes(32)
  throws(() => nw.lookup(topic), Error('Bind before doing a lookup'))
})

test('propagates tcp server start errors', async ({ rejects }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const nw = promisifyApi(network({ bootstrap }))
  nw.tcp.listen = (port) => {
    nw.tcp.emit('error', Error('test'))
  }
  await rejects(() => nw.bind(), Error('test'))
  closeDht()
})

test('propagates utp server start errors', async ({ rejects }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const nw = promisifyApi(network({ bootstrap }))
  nw.utp.listen = (port) => {
    nw.utp.emit('error', Error('test'))
  }
  await rejects(() => nw.bind(), Error('test'))
  closeDht()
})

test('bind to preferred port, when available', async ({ is }) => {
  const port = await getPort()
  const nw = promisifyApi(network())
  await nw.bind(port)
  is(nw.address().port, port)
  await nw.close()
})

test('bind to alternative to preferred port, when preferred port is available', async ({ isNot }) => {
  const port = await getPort()
  const server = createServer().listen(port)
  const nw = promisifyApi(network())
  await nw.bind(port)
  isNot(nw.address().port, port)
  await nw.close()
  server.close()
  await once(server, 'close')
})

test('bind to any port when preferred port param is a falsey value', async ({ resolves, pass }) => {
  const nw = promisifyApi(network({
    bind () { pass('peer bound') }
  }))
  await resolves(async () => nw.bind(null))
  await nw.close()
})

test('connect two peers with address details', async ({ is, pass }) => {
  const nw = promisifyApi(network())
  await nw.bind()
  const client = promisifyApi(network())
  const { port } = nw.address()
  const host = '127.0.0.1'
  const { socket } = await client.connect({ port, host })
  is(validSocket(socket), true, 'got client socket')
  await client.close()
  pass('client closed')
  await nw.close()
  pass('network closed')
})

test('lookup emits peers that announce on a topic', async ({ is }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const p1 = promisifyApi(network({ bootstrap }))
  await p1.bind()
  const p2 = promisifyApi(network({ bootstrap }))
  await p2.bind()
  const client = promisifyApi(network({ bootstrap }))
  const topic = randomBytes(32)
  await client.bind()
  const lookup = client.lookup(topic)
  p1.announce(topic)
  p2.announce(topic)
  const [ r1 ] = await once(lookup, 'peer')
  is(r1.port, p1.address().port)
  is(r1.local, true)
  is(r1.topic, topic)
  const [ r2 ] = await once(lookup, 'peer')
  is(r2.port, p2.address().port)
  is(r2.local, true)
  is(r2.topic, topic)
  await p1.close()
  await p2.close()
  await client.close()
  closeDht()
})

test('lookupOne gets the first peer found', async ({ is }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const p1 = promisifyApi(network({ bootstrap }))
  await p1.bind()
  const p2 = promisifyApi(network({ bootstrap }))
  await p2.bind()
  const client = promisifyApi(network({ bootstrap }))
  const topic = randomBytes(32)
  await client.bind()
  p1.announce(topic)
  p2.announce(topic)
  const lookup = await client.lookupOne(topic)
  is(lookup.port, p1.address().port)
  is(lookup.local, true)
  is(lookup.topic, topic)
  await p1.close()
  await p2.close()
  await client.close()
  closeDht()
})

test('connect two peers via lookupOne', async ({ is, pass }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const nw = promisifyApi(network({ bootstrap }))
  await nw.bind()
  const client = promisifyApi(network({ bootstrap }))
  const topic = randomBytes(32)
  await once(nw.announce(topic), 'update')
  await client.bind()
  const peer = await client.lookupOne(topic)
  const { socket } = await client.connect(peer)
  is(validSocket(socket), true, 'got client socket')
  await client.close()
  pass('client closed')
  await nw.close()
  pass('network closed')
  closeDht()
})

test('announce with lookup option emits peers that announce on a topic', async ({ is }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const p1 = promisifyApi(network({ bootstrap }))
  await p1.bind()
  const p2 = promisifyApi(network({ bootstrap }))
  await p2.bind()
  const client = promisifyApi(network({ bootstrap }))
  const topic = randomBytes(32)
  await client.bind()
  const lookup = client.announce(topic, { lookup: true })
  p1.announce(topic)
  p2.announce(topic)
  const [ r1 ] = await once(lookup, 'peer')
  is(r1.port, p1.address().port)
  is(r1.local, true)
  is(r1.topic, topic)
  const [ r2 ] = await once(lookup, 'peer')
  is(r2.port, p2.address().port)
  is(r2.local, true)
  is(r2.topic, topic)
  await p1.close()
  await p2.close()
  await client.close()
  closeDht()
})

test('socket recieved – socket option – (address details based connection)', async ({ is }) => {
  const until = when()
  const nw = promisifyApi(network({
    async socket (sock) {
      is(validSocket(sock), true)
      await nw.close()
      await client.close()
      until()
    }
  }))
  await nw.bind()
  const client = promisifyApi(network())
  const { port } = nw.address()
  const host = '127.0.0.1'
  await client.connect({ port, host })
  await until.done()
})

test('socket recieved – socket option – (lookup based connection)', async ({ is }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const until = when()
  const nw = promisifyApi(network({
    bootstrap,
    async socket (sock) {
      is(validSocket(sock), true)
      await nw.close()
      await client.close()
      until()
    }
  }))
  await nw.bind()
  const client = promisifyApi(network({ bootstrap }))
  const topic = randomBytes(32)
  const sub = nw.announce(topic)
  await once(sub, 'update')
  await client.bind()
  const peer = await client.lookupOne(topic)
  await client.connect(peer)
  await until.done()
  closeDht()
})

test('send data to nw peer', async ({ is }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const until = when()
  const nw = promisifyApi(network({
    bootstrap,
    async socket (sock) {
      const [ data ] = await once(sock, 'data')
      is(data.toString(), 'test')
      await nw.close()
      await client.close()
      until()
    }
  }))
  await nw.bind()
  const client = promisifyApi(network({ bootstrap }))
  const topic = randomBytes(32)
  const sub = nw.announce(topic)
  await once(sub, 'update')
  await client.bind()
  const peer = await client.lookupOne(topic)
  const { socket } = await client.connect(peer)
  socket.write('test')
  await until.done()
  closeDht()
})

test('send data to client peer', async ({ is }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const until = when()
  const nw = promisifyApi(network({
    bootstrap,
    async socket (socket) {
      socket.write('test')
      await nw.close()
      await client.close()
      until()
    }
  }))
  await nw.bind()
  const client = promisifyApi(network({ bootstrap }))
  const topic = randomBytes(32)
  const sub = nw.announce(topic)
  await once(sub, 'update')
  await client.bind()
  const peer = await client.lookupOne(topic)
  const { socket } = await client.connect(peer)
  const [ data ] = await once(socket, 'data')
  is(data.toString(), 'test')
  await until.done()
  closeDht()
})

test('send data bidirectionally between nw and client', async ({ is }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const until = when()
  const nw = promisifyApi(network({
    bootstrap,
    async socket (socket) {
      const [ data ] = await once(socket, 'data')
      is(data.toString(), 'from client')
      socket.write('from network')
      await nw.close()
      await client.close()
      until()
    }
  }))
  await nw.bind()
  const client = promisifyApi(network({ bootstrap }))
  const topic = randomBytes(32)
  const sub = nw.announce(topic)
  await once(sub, 'update')
  await client.bind()
  const peer = await client.lookupOne(topic)
  const { socket } = await client.connect(peer)
  socket.write('from client')
  const [ data ] = await once(socket, 'data')
  is(data.toString(), 'from network')
  await until.done()
  closeDht()
})

test('referrer node (peer info from DHT)', async ({ is }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const nw = promisifyApi(network({ bootstrap }))
  await nw.bind()
  const client = promisifyApi(network({ bootstrap }))
  const referrer = dgram.createSocket('udp4')
  await promisify(referrer.bind.bind(referrer))()
  const connecting = client.connect({
    host: '127.0.0.1',
    port: nw.address().port,
    referrer: {
      host: '127.0.0.1',
      port: referrer.address().port
    }
  })
  const [ msg ] = await once(referrer, 'message')
  is(/_holepunch/.test(msg), true, 'triggers a holepunch command to referrer node')
  // not strictly necessary, since we would never get msg
  // if client was connected, however for explicitness sake:
  await connecting
  await nw.close()
  await client.close()
  await promisify(referrer.close.bind(referrer))()
  closeDht()
})

test('binds when connecting to peer with referrer node', async ({ pass }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const nw = promisifyApi(network({ bootstrap }))
  await nw.bind()
  const client = promisifyApi(network({
    bootstrap,
    bind () {
      pass('client bound after connect')
    }
  }))
  const referrer = dgram.createSocket('udp4')
  await promisify(referrer.bind.bind(referrer))()
  await client.connect({
    host: '127.0.0.1',
    port: nw.address().port,
    referrer: {
      host: '127.0.0.1',
      port: referrer.address().port
    }
  })
  await nw.close()
  await client.close()
  await promisify(referrer.close.bind(referrer))()
  closeDht()
})

test('retries after binding error when attempting to connect to peer with referrer', async ({ is }) => {
  const { bootstrap, closeDht } = await dhtBootstrap()
  const nw = promisifyApi(network({ bootstrap }))
  await nw.bind()
  const client = promisifyApi(network({ bootstrap }))
  const referrer = dgram.createSocket('udp4')
  await promisify(referrer.bind.bind(referrer))()
  // create an error scenario:
  var count = 0
  client.tcp.listen = async (port) => {
    count++
    client.tcp.emit('error', Error('test'))
  }
  await client.connect({
    host: '127.0.0.1',
    port: nw.address().port,
    referrer: {
      host: '127.0.0.1',
      port: referrer.address().port
    }
  })
  is(count, 7)
  await client.close()
  await nw.close()
  await promisify(referrer.close.bind(referrer))()
  closeDht()
})

test('tcp socket connection timeout prior to holepunch from bind due to referrer', async ({ rejects }) => {
  compatifyTcp.on()
  try {
    const { bootstrap, closeDht } = await dhtBootstrap()
    const nw = promisifyApi(network({ bootstrap }))
    await nw.bind()
    const client = promisifyApi(network({ bootstrap }))
    const referrer = dgram.createSocket('udp4')
    await promisify(referrer.bind.bind(referrer))()
    const connecting = client.connect({
      host: '127.0.0.1',
      port: nw.address().port,
      referrer: {
        host: '127.0.0.1',
        port: referrer.address().port
      }
    })
    await nw.close()
    await rejects(async () => connecting, Error('Request timed out'))
    await client.close()
    await promisify(referrer.close.bind(referrer))()
    closeDht()
  } finally {
    compatifyTcp.off()
  }
})

test('holepunch attempt resulting from referrer node fails before tcp connection is estabilished but after successful bind', async ({ resolves }) => {
  // results in the holepunch error being swallowed
  // (because the tcp socket is still recognized as being open)
  const { bootstrap, closeDht } = await dhtBootstrap()
  const nw = promisifyApi(network({ bootstrap }))
  nw.name = 'network'
  await nw.bind()
  const { port } = nw.address()
  const client = promisifyApi(network({
    bind () {
      // fake holepunch error before connected
      const { holepunch } = client.discovery
      client.discovery.holepunch = (peer, cb) => {
        client.discovery.holepunch = holepunch
        cb(Error('Request cancelled'))
      }
    },
    bootstrap
  }))
  client.name = 'client'
  const referrer = dgram.createSocket('udp4')
  await promisify(referrer.bind.bind(referrer))()
  await resolves(async () => client.connect({
    host: '127.0.0.1',
    port: port,
    referrer: {
      host: '127.0.0.1',
      port: referrer.address().port
    }
  }))
  await promisify(referrer.close.bind(referrer))()
  await client.close()
  await nw.close()
  closeDht()
})

test('"All sockets failed" trigger when bind fails and tcp fails after', async ({ rejects }) => {
  compatifyTcp.on()
  try {
    const { bootstrap, closeDht } = await dhtBootstrap()
    const nw = promisifyApi(network({ bootstrap }))
    await nw.bind()
    const client = promisifyApi(network({ bootstrap }))
    const referrer = dgram.createSocket('udp4')
    await promisify(referrer.bind.bind(referrer))()
    // create an error scenario:
    var count = 0
    client.tcp.listen = async (port) => {
      count++
      client.tcp.emit('error', Error('test'))
      if (count === 7) {
        compatifyTcp.emitSocketClose()
        await nw.close() // create a closes === 0 situation
      }
    }
    const connecting = client.connect({
      host: '127.0.0.1',
      port: nw.address().port,
      referrer: {
        host: '127.0.0.1',
        port: referrer.address().port
      }
    })

    await rejects(() => connecting, Error('All sockets failed'))
    await client.close()
    await promisify(referrer.close.bind(referrer))()
    closeDht()
  } finally {
    compatifyTcp.off()
  }
})

test('"All sockets failed" error when peer connection closes *after* bind retry count is reached', async ({ rejects }) => {
  compatifyTcp.on()
  try {
    const { bootstrap, closeDht } = await dhtBootstrap()
    const nw = promisifyApi(network({ bootstrap }))
    await nw.bind()
    const client = promisifyApi(network({ bootstrap }))
    const referrer = dgram.createSocket('udp4')
    await promisify(referrer.bind.bind(referrer))()
    // create an error scenario:
    client.tcp.listen = async (port) => {
      client.tcp.emit('error', Error('test'))
    }
    const connecting = client.connect({
      host: '127.0.0.1',
      port: nw.address().port,
      referrer: {
        host: '127.0.0.1',
        port: referrer.address().port
      }
    })
    nw.close()
    await rejects(() => connecting, Error('All sockets failed'))
    await client.close()
    await promisify(referrer.close.bind(referrer))()
    closeDht()
  } finally {
    compatifyTcp.off()
  }
})

test('attempt to connect to closed peer', async ({ rejects }) => {
  const nw = promisifyApi(network())
  await nw.bind()
  const { port } = nw.address()
  await nw.close()
  const client = promisifyApi(network())
  await client.bind()
  const host = '127.0.0.1'
  await rejects(client.connect({ port, host }), Error('All sockets failed'))
  await client.close()
})

test('attempt to connect from closed peer', async ({ rejects }) => {
  const nw = promisifyApi(network())
  await nw.bind()
  const { port } = nw.address()
  const client = promisifyApi(network())
  await client.bind()
  await client.close()
  const host = '127.0.0.1'
  await rejects(client.connect({ port, host }), Error('All sockets failed'))
  await nw.close()
})

test('temporary tcp connection outage prior holepunch from bind due to referrer', async ({ is }) => {
  compatifyTcp.on()
  try {
    // results in a utp connection instead of tcp
    const { bootstrap, closeDht } = await dhtBootstrap()
    const nw = promisifyApi(network({ bootstrap }))
    await nw.bind()
    const { port } = nw.address()
    const client = promisifyApi(network({
      bind () {
        // fake holepunch completion before connected
        const { holepunch } = client.discovery
        client.discovery.holepunch = async (peer, cb) => {
          client.discovery.holepunch = holepunch
          nw.tcp = createServer().listen(port)
          await once(nw.tcp, 'listening')
          nw.tcp.unref()
          cb()
        }
      },
      bootstrap
    }))
    const referrer = dgram.createSocket('udp4')
    await promisify(referrer.bind.bind(referrer))()
    const connecting = client.connect({
      host: '127.0.0.1',
      port: port,
      referrer: {
        host: '127.0.0.1',
        port: referrer.address().port
      }
    })
    // simulate nw failure
    const { tcp } = nw
    tcp.close()
    await once(tcp, 'close')
    const { isTcp } = await connecting
    is(isTcp, false, 'UDP socket')
    await nw.close()
    await promisify(referrer.close.bind(referrer))()
    // this scenario causes client peer's utp instance
    // to become unclosable, unref in order to allow
    // process to exit
    client.utp.unref()
    client.close()
    closeDht()
  } finally {
    compatifyTcp.off()
  }
})

test('destroys socket on error (tcp)', async ({ is, pass, plan }) => {
  plan(4)
  const nw = promisifyApi(network())
  await nw.bind()
  const client = promisifyApi(network())
  const { port } = nw.address()
  const host = '127.0.0.1'
  const { socket } = await client.connect({ port, host })
  is(validSocket(socket), true, 'got client socket')
  const testErr = Error('test')
  const { destroy } = socket
  socket.destroy = (err) => {
    is(err, testErr, 'error passed')
    return destroy.call(socket, err)
  }
  socket.emit('error', testErr)
  await client.close()
  pass('client closed')
  await nw.close()
  pass('network closed')
})

test('only destroys socket once on error (tcp)', async ({ is, pass, plan, fail }) => {
  plan(4)
  const nw = promisifyApi(network())
  await nw.bind()
  const client = promisifyApi(network())
  const { port } = nw.address()
  const host = '127.0.0.1'
  const { socket } = await client.connect({ port, host })
  is(validSocket(socket), true, 'got client socket')
  const testErr = Error('test')
  const { destroy } = socket
  socket.destroy = (err) => {
    is(err, testErr, 'error passed')
    socket.destroy = () => fail('destroy called again')
    return destroy.call(socket, err)
  }
  socket.emit('error', testErr)
  socket.emit('error', testErr)
  await client.close()
  pass('client closed')
  await nw.close()
  pass('network closed')
})

test('only destroys socket once on error (utp)', async ({ is, plan, fail }) => {
  plan(2)
  compatifyTcp.on()
  try {
    // results in a utp connection instead of tcp
    const { bootstrap, closeDht } = await dhtBootstrap()
    const nw = promisifyApi(network({ bootstrap }))
    await nw.bind()
    const { port } = nw.address()
    const client = promisifyApi(network({
      bind () {
        // fake holepunch completion before connected
        const { holepunch } = client.discovery
        client.discovery.holepunch = async (peer, cb) => {
          client.discovery.holepunch = holepunch
          nw.tcp = createServer().listen(port)
          await once(nw.tcp, 'listening')
          nw.tcp.unref()
          cb()
        }
      },
      bootstrap
    }))
    const referrer = dgram.createSocket('udp4')
    await promisify(referrer.bind.bind(referrer))()
    const connecting = client.connect({
      host: '127.0.0.1',
      port: port,
      referrer: {
        host: '127.0.0.1',
        port: referrer.address().port
      }
    })
    // simulate nw failure
    const { tcp } = nw
    tcp.close()
    await once(tcp, 'close')
    const { socket, isTcp } = await connecting
    is(isTcp, false, 'UDP socket')
    const testErr = Error('test')
    const { destroy } = socket
    socket.destroy = (err) => {
      is(err, testErr, 'error passed')
      socket.destroy = () => fail('socket destroyed again')
      return destroy.call(socket, err)
    }
    socket.emit('error', testErr)
    await promisify(setImmediate)
    socket.emit('error', testErr)
    await promisify(setImmediate)
    socket.destroy = destroy
    await nw.close()
    await promisify(referrer.close.bind(referrer))()
    // this scenario causes client peer's utp instance
    // to become unclosable, unref in order to allow
    // process to exit
    client.utp.unref()
    client.close()
    closeDht()
  } finally {
    compatifyTcp.off()
  }
})

test('destroys socket on error (utp)', async ({ is, plan }) => {
  plan(2)
  compatifyTcp.on()
  try {
    // results in a utp connection instead of tcp
    const { bootstrap, closeDht } = await dhtBootstrap()
    const nw = promisifyApi(network({ bootstrap }))
    await nw.bind()
    const { port } = nw.address()
    const client = promisifyApi(network({
      bind () {
        // fake holepunch completion before connected
        const { holepunch } = client.discovery
        client.discovery.holepunch = async (peer, cb) => {
          client.discovery.holepunch = holepunch
          nw.tcp = createServer().listen(port)
          await once(nw.tcp, 'listening')
          nw.tcp.unref()
          cb()
        }
      },
      bootstrap
    }))
    const referrer = dgram.createSocket('udp4')
    await promisify(referrer.bind.bind(referrer))()
    const connecting = client.connect({
      host: '127.0.0.1',
      port: port,
      referrer: {
        host: '127.0.0.1',
        port: referrer.address().port
      }
    })
    // simulate nw failure
    const { tcp } = nw
    tcp.close()
    await once(tcp, 'close')
    const { socket, isTcp } = await connecting
    is(isTcp, false, 'UDP socket')
    const testErr = Error('test')
    const { destroy } = socket
    socket.destroy = (err) => {
      is(err, testErr, 'error passed')
      socket.destroy = destroy
      return destroy.call(socket, err)
    }
    socket.emit('error', testErr)
    await nw.close()
    await promisify(referrer.close.bind(referrer))()
    // this scenario causes client peer's utp instance
    // to become unclosable, unref in order to allow
    // process to exit
    client.utp.unref()
    client.close()
    closeDht()
  } finally {
    compatifyTcp.off()
  }
})
