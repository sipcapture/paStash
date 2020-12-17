'use strict'
const assert = require('assert')
const {
  crypto_sign_keypair: createKeypair,
  crypto_sign_detached: sign,
  crypto_generichash: hash,
  crypto_sign_PUBLICKEYBYTES: pkSize,
  crypto_sign_SECRETKEYBYTES: skSize,
  crypto_sign_BYTES: signSize,
  randombytes_buf: randomBytes
} = require('sodium-native')

// VALUE_MAX_SIZE + packet overhead (i.e. the key etc.)
// should be less than the network MTU, normally 1400 bytes
const VALUE_MAX_SIZE = 1000

const saltSeg = Buffer.from('4:salt')
const seqSeg = Buffer.from('3:seqi')
const vSeg = Buffer.from('1:v')

class Hypersign {
  salt (str = null, size = 32) {
    if (typeof str === 'number') {
      size = str
      str = null
    }
    assert(
      size >= 16 && size <= 64,
      'salt size must be between 16 and 64 bytes (inclusive)'
    )
    const salt = Buffer.alloc(size)
    if (typeof str === 'string') hash(salt, Buffer.from(str))
    else randomBytes(salt)
    return salt
  }

  keypair () {
    const publicKey = Buffer.alloc(pkSize)
    const secretKey = Buffer.alloc(skSize)
    createKeypair(publicKey, secretKey)
    return { publicKey, secretKey }
  }

  cryptoSign (msg, keypair) {
    assert(Buffer.isBuffer(msg), 'msg must be a buffer')
    assert(keypair, 'keypair is required')
    const { secretKey } = keypair
    assert(Buffer.isBuffer(secretKey), 'keypair.secretKey is required')
    const signature = Buffer.alloc(signSize)
    sign(signature, msg, secretKey)
    return signature
  }

  sign (value, opts) {
    assert(typeof opts === 'object', 'Options are required')
    assert(Buffer.isBuffer(value), 'Value must be a buffer')
    assert(value.length <= VALUE_MAX_SIZE, `Value size must be <= ${VALUE_MAX_SIZE}`)
    const { keypair } = opts
    assert(keypair, 'keypair is required')
    const { secretKey } = keypair
    assert(Buffer.isBuffer(secretKey), 'keypair.secretKey is required')
    const msg = this.signable(value, opts)
    const signature = Buffer.alloc(signSize)
    sign(signature, msg, secretKey)
    return signature
  }

  signable (value, opts = {}) {
    const { salt, seq = 0 } = opts
    assert(Buffer.isBuffer(value), 'Value must be a buffer')
    assert(value.length <= VALUE_MAX_SIZE, `Value size must be <= ${VALUE_MAX_SIZE}`)
    if (salt) {
      assert(Buffer.isBuffer(salt), 'salt must be a buffer')
      assert(
        salt.length <= 64,
        'salt size must be no greater than 64 bytes'
      )
    }

    return salt ? Buffer.concat([
      saltSeg,
      Buffer.from(`${salt.length}:`),
      salt,
      seqSeg,
      Buffer.from(`${seq.toString()}e`),
      vSeg,
      Buffer.from(`${value.length}:`),
      value
    ]) : Buffer.concat([
      seqSeg,
      Buffer.from(`${seq.toString()}e`),
      vSeg,
      Buffer.from(`${value.length}:`),
      value
    ])
  }
}

module.exports = () => new Hypersign()
module.exports.Hypersign = Hypersign
module.exports.VALUE_MAX_SIZE = VALUE_MAX_SIZE
