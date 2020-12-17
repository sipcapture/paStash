const blake2b = require('blake2b')

module.exports = function (out, data, key) {
  blake2b(out.length, key).update(data).digest(out)
}

module.exports.batch = function (out, batch, key) {
  const b = blake2b(out.length, key)
  for (let i = 0; i < batch.length; i++) b.update(batch[i])
  b.digest(out)
}
