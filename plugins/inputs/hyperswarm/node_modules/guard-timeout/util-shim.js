'use strict'

try {
  // will only succeed if util module is already bundled
  module.exports = require('ut' + 'il')
  // will throw for older browserify util polyfills:
  if (!module.exports.promisify || !module.exports.promisify.custom) {
    throw Error('current browserified util shim does not have promisify')
  }
} catch (e) {
  const promisify = (fn) => {
    return fn[promisify.custom]
  }
  // currently Node.js does not expose the promisify custom symbol,
  // but if it did will likely use the same pattern as the inspect symbol
  promisify.custom = Symbol.for('nodejs.util.promisify.custom')

  module.exports = { promisify }
}
