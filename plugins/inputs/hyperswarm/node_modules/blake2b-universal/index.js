const sodium = require('sodium-native')

module.exports = function (out, data, key) {
  if (key) sodium.crypto_generichash(out, data, key)
  else sodium.crypto_generichash(out, data)
}

module.exports.batch = function (out, batch, key) {
  if (key) sodium.crypto_generichash_batch(out, batch, key)
  else sodium.crypto_generichash_batch(out, batch)
}
