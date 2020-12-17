'use strict'
const { test } = require('tap')
const {
  crypto_sign_verify_detached: verify,
  crypto_generichash: hash
} = require('sodium-universal')
const hypersign = require('../')()
const bencode = require('bencode')
test('keypair', async ({ is }) => {
  const { publicKey, secretKey } = hypersign.keypair()
  is(publicKey instanceof Buffer, true)
  is(publicKey.length, 32)
  is(secretKey instanceof Buffer, true)
  is(secretKey.length, 64)
})

test('salt', async ({ is, throws }) => {
  const salt = hypersign.salt()
  is(salt instanceof Buffer, true)
  is(salt.length, 32)
  is(hypersign.salt(64).length, 64)
  throws(() => hypersign.salt(15))
  throws(() => hypersign.salt(65))
})

test('salt string', async ({ is, throws }) => {
  const salt = hypersign.salt('test')
  is(salt instanceof Buffer, true)
  is(salt.length, 32)
  is(hypersign.salt(64).length, 64)
  const check = Buffer.alloc(32)
  hash(check, Buffer.from('test'))
  is(salt.equals(check), true)
  throws(() => hypersign.salt('test', 15))
  throws(() => hypersign.salt('test', 65))
})

test('signable', async ({ is, same }) => {
  const salt = hypersign.salt()
  const value = Buffer.from('test')
  same(
    hypersign.signable(value),
    bencode.encode({ seq: 0, v: value }).slice(1, -1)
  )
  same(
    hypersign.signable(value, { seq: 1 }),
    bencode.encode({ seq: 1, v: value }).slice(1, -1)
  )
  same(
    hypersign.signable(value, { salt }),
    bencode.encode({ salt, seq: 0, v: value }).slice(1, -1)
  )
})

test('signable - decodable with bencode', async ({ is, same }) => {
  const salt = hypersign.salt()
  const value = Buffer.from('test')
  const msg = hypersign.signable(value, { salt })
  const result = bencode.decode(
    Buffer.concat([Buffer.from('d'), msg, Buffer.from('e')])
  )
  is(Buffer.isBuffer(result.salt), true)
  is(Buffer.isBuffer(result.v), true)
  same(result.salt, salt)
  same(result.v, value)
  is(result.seq, 0)
})

test('signable - salt must be a buffer', async ({ throws }) => {
  throws(() => hypersign.signable(Buffer.from('test'), { salt: 'no' }), 'salt must be a buffer')
})

test('signable - salt size must be no greater than 64 bytes', async ({ throws }) => {
  throws(
    () => hypersign.signable(Buffer.from('test'), { salt: Buffer.alloc(65) }),
    'salt size must be no greater than 64 bytes'
  )
})

test('signable - value must be buffer', async ({ throws }) => {
  const keypair = hypersign.keypair()
  throws(() => hypersign.signable('test', { keypair }), 'Value must be a buffer')
})

test('signable - value size must be <= 1000 bytes', async ({ throws }) => {
  const keypair = hypersign.keypair()
  throws(
    () => hypersign.signable(Buffer.alloc(1001), { keypair }),
    'Value size must be <= 1000'
  )
})

test('sign', async ({ is }) => {
  const keypair = hypersign.keypair()
  const { publicKey } = keypair
  const salt = hypersign.salt()
  const value = Buffer.from('test')
  is(
    verify(
      hypersign.sign(value, { keypair }),
      hypersign.signable(value),
      publicKey
    ),
    true
  )
  is(
    verify(
      hypersign.sign(value, { salt, keypair }),
      hypersign.signable(value, { salt }),
      publicKey
    ),
    true
  )
  is(
    verify(
      hypersign.sign(value, { seq: 2, keypair }),
      hypersign.signable(value, { seq: 2 }),
      publicKey
    ),
    true
  )
})

test('sign - salt must be a buffer', async ({ throws }) => {
  throws(() => hypersign.sign(Buffer.from('test'), { salt: 'no' }), 'salt must be a buffer')
})

test('sign - salt size must be >= 16 bytes and <= 64 bytes', async ({ throws }) => {
  throws(
    () => hypersign.sign(Buffer.from('test'), { salt: Buffer.alloc(15) }),
    'salt size must be between 16 and 64 bytes (inclusive)'
  )
  throws(
    () => hypersign.sign(Buffer.from('test'), { salt: Buffer.alloc(65) }),
    'salt size must be between 16 and 64 bytes (inclusive)'
  )
})

test('sign - value must be buffer', async ({ throws }) => {
  const keypair = hypersign.keypair()
  throws(() => hypersign.sign('test', { keypair }), 'Value must be a buffer')
})

test('sign - options are required', async ({ throws }) => {
  throws(() => hypersign.sign('test'), 'Options are required')
})

test('sign - value size must be <= 1000 bytes', async ({ throws }) => {
  const keypair = hypersign.keypair()
  throws(
    () => hypersign.sign(Buffer.alloc(1001), { keypair }),
    'Value size must be <= 1000'
  )
})

test('sign - keypair option is required', async ({ throws }) => {
  throws(
    () => hypersign.sign(Buffer.alloc(1001), {}),
    'keypair is required'
  )
})

test('sign - keypair must have secretKey which must be a buffer', async ({ throws }) => {
  const keypair = hypersign.keypair()
  keypair.secretKey = 'nope'
  throws(
    () => hypersign.sign(Buffer.alloc(1001), { keypair }),
    'keypair.secretKey is required'
  )
  delete keypair.secretKey
  throws(
    () => hypersign.sign(Buffer.alloc(1001), { keypair }),
    'keypair.secretKey is required'
  )
})

test('cryptoSign - msg must be buffer', async ({ throws }) => {
  const keypair = hypersign.keypair()
  throws(() => hypersign.cryptoSign('test', keypair), 'msg must be a buffer')
})

test('cryptoSign - keypair is required', async ({ throws }) => {
  throws(() => hypersign.cryptoSign('test'), 'keypair is required')
})

test('cryptoSign - keypair must have secretKey which must be a buffer', async ({ throws }) => {
  const keypair = hypersign.keypair()
  keypair.secretKey = 'nope'
  throws(
    () => hypersign.cryptoSign(Buffer.alloc(1001), { keypair }),
    'keypair.secretKey is required'
  )
  delete keypair.secretKey
  throws(
    () => hypersign.cryptoSign(Buffer.alloc(1001), { keypair }),
    'keypair.secretKey is required'
  )
})

test('cryptoSign', async ({ is }) => {
  const keypair = hypersign.keypair()
  const { publicKey } = keypair
  const salt = hypersign.salt()
  const value = Buffer.from('test')
  is(
    verify(
      hypersign.cryptoSign(hypersign.signable(value), keypair),
      hypersign.signable(value),
      publicKey
    ),
    true
  )
  is(
    verify(
      hypersign.cryptoSign(hypersign.signable(value, { salt }), keypair),
      hypersign.signable(value, { salt }),
      publicKey
    ),
    true
  )
  is(
    verify(
      hypersign.cryptoSign(hypersign.signable(value, { seq: 2 }), keypair),
      hypersign.signable(value, { seq: 2 }),
      publicKey
    ),
    true
  )
})
