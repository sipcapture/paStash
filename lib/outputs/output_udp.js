var abstract_udp = require('./abstract_udp'),
  util = require('util');

function OutputUdp() {
  abstract_udp.AbstractUdp.call(this);
  this.mergeConfig({
    name: 'Udp',
  });
  this.mergeConfig(this.serializer_config());
}

util.inherits(OutputUdp, abstract_udp.AbstractUdp);

OutputUdp.prototype.formatPayload = function(data, callback) {
  if (this.serializer === 'raw' && Buffer.isBuffer(data.message) && this.format === '#{message}') {
    return callback(data.message);
  }
  callback(Buffer.from(this.serialize_data(data)));
};

OutputUdp.prototype.to = function() {
  return ' udp ' + this.host + ':' + this.port;
};

exports.create = function() {
  return new OutputUdp();
};
