var abstract_utp = require('./abstract_utp'),
  util = require('util');

function OutputUtp() {
  abstract_utp.AbstractUtp.call(this);
  this.mergeConfig({
    name: 'Utp',
  });
  this.mergeConfig(this.serializer_config());
}

util.inherits(OutputUtp, abstract_utp.AbstractUtp);

OutputUtp.prototype.formatPayload = function(data, callback) {
  callback(new Buffer(this.serialize_data(data)));
};

OutputUtp.prototype.to = function() {
  return ' utp ' + this.host + ':' + this.port;
};

exports.create = function() {
  return new OutputUtp();
};
