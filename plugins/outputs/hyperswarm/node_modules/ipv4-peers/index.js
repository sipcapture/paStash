module.exports = create(0)

function create (idLength) {
  if (!idLength) idLength = 0

  var entrySize = idLength + 6

  encode.bytes = decode.bytes = 0

  return {
    idLength: create,
    encodingLength: encodingLength,
    encode: encode,
    decode: decode
  }

  function encodingLength (peers) {
    return peers.length * entrySize
  }

  function encode (peers, buf, offset) {
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(peers))
    if (!offset) offset = 0

    for (var i = 0; i < peers.length; i++) {
      if (idLength) {
        peers[i].id.copy(buf, offset)
        offset += idLength
      }

      var host = peers[i].host.split('.')
      var port = peers[i].port
      buf[offset++] = parseInt(host[0], 10)
      buf[offset++] = parseInt(host[1], 10)
      buf[offset++] = parseInt(host[2], 10)
      buf[offset++] = parseInt(host[3], 10)
      buf.writeUInt16BE(port, offset)
      offset += 2
    }

    encode.bytes = peers.length * entrySize
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length

    var peers = new Array(Math.floor((end - offset) / entrySize))

    for (var i = 0; i < peers.length; i++) {
      var id = null
      if (idLength) {
        id = buf.slice(offset, offset + idLength)
        offset += idLength
      }
      var host = buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++] + '.' + buf[offset++]
      var port = buf.readUInt16BE(offset)

      if (port === 0) throw new RangeError('Port should be > 0 and < 65536')

      peers[i] = id ? {id: id, host: host, port: port} : {host: host, port: port}
      offset += 2
    }

    decode.bytes = peers.length * entrySize
    return peers
  }
}
