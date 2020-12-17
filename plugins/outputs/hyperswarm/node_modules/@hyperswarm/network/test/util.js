'use strict'
const { promisify } = require('util')
const net = compatifyTcp(require('net'))
const UTP = require('utp-native')
const dht = require('@hyperswarm/dht')
const once = require('events.once')
const win32 = process.platform === 'win32'

const promisifyApi = (o) => {
  var kCustomPromisifyArgsSymbol = null
  promisify(new Proxy(() => {}, { get (_, p) {
    if (/PromisifyArgs/.test(p.toString())) {
      kCustomPromisifyArgsSymbol = p
    }
  } }))
  o.connect[kCustomPromisifyArgsSymbol] = ['socket', 'isTcp']
  const connect = promisify(o.connect)
  const lookupOne = promisify(o.lookupOne)
  const bind = promisify(o.bind)
  const close = promisify(o.close)
  return {
    __proto__: o,
    connect,
    lookupOne,
    bind,
    close
  }
}

// `net.connect` on Windows behaves
// differently. So we wrap `net` in order provide a utility
// to artificially create the same behaviour cross-platform,
// specifically for situations where we're generating
// a connection failure
function compatifyTcp (net) {
  const { connect, createServer } = net
  net.connect = (...args) => {
    if (win32 === false || compatifyTcp.enabled === false) {
      return connect.call(net, ...args)
    }
    const socket = connect.call(net, ...args)
    const { emit } = socket
    const [ port ] = args
    socket.emit = (evt, ...args) => {
      if (compatifyTcp.closedServerPorts.has(port)) {
        if (evt === 'ready') return
        if (evt === 'connect') {
          const { stackTraceLimit } = Error
          Error.stackTraceLimit = 0
          const err = Error()
          err.stackTraceLimit = stackTraceLimit
          err.errno = 'ECONNRESET'
          err.code = 'ECONNRESET'
          err.syscall = 'connect'
          err.address = '127.0.0.1'
          err.port = port
          socket.destroy(err)
          return
        }
      }
      return emit.call(socket, evt, ...args)
    }
    compatifyTcp.lastSocket = socket
    return socket
  }
  net.createServer = (...args) => {
    if (win32 === false || compatifyTcp.enabled === false) {
      return createServer.call(net, ...args)
    }
    const server = createServer(...args)
    const { close } = server
    server.close = (...args) => {
      compatifyTcp.closedServerPorts.add(server.address().port)
      return close.call(server, ...args)
    }
    return server
  }
  return net
}
compatifyTcp.closedServerPorts = new Set()
compatifyTcp.on = () => {
  compatifyTcp.closedServerPorts.clear()
  compatifyTcp.lastSocket = null
  compatifyTcp.enabled = true
}
compatifyTcp.off = () => { compatifyTcp.enabled = false }
compatifyTcp.emitSocketClose = () => {
  if (!compatifyTcp.lastSocket) return
  compatifyTcp.lastSocket.emit('close')
}
compatifyTcp.enabled = false

const when = () => {
  var done = () => { throw Error('did not happen') }
  const fn = () => done()
  fn.done = promisify((cb) => { done = cb })
  return fn
}

function validSocket (s) {
  if (!s) return false
  return (s instanceof net.Socket) || (s._utp && s._utp instanceof UTP)
}

async function dhtBootstrap () {
  const node = dht({ bootstrap: [] })
  node.listen()
  await once(node, 'listening')
  const { port } = node.address()
  return {
    port,
    bootstrap: [`127.0.0.1:${port}`],
    closeDht: () => node.destroy()
  }
}

module.exports = {
  promisifyApi,
  compatifyTcp,
  when,
  validSocket,
  dhtBootstrap
}
