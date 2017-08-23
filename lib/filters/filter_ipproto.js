var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

function FilterComputeProtocol() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'ipproto',
    optional_params: ['target_field'],
    host_field: 'source_field',
    start_hook: this.start,
  });
}

var ipProto = {
	1:   "icmp",
	2:   "igmp",
	6:   "tcp",
	9:   "egp",
	17:  "udp",
	27:  "rdp",
	41:  "encap-v6",
	47:  "gre",
	56:  "tlsp",
	58:  "icmp-v6",
	89:  "ospf",
	94:  "ipip",
	132: "sctp"
};

util.inherits(FilterComputeProtocol, base_filter.BaseFilter);

FilterComputeProtocol.prototype.start = function(callback) {
  if (!this.target_field) {
    this.target_field = this.source_field;
  }
  logger.info('Initializing IP protocol filter from', this.source_field, 'to', this.target_field);
  callback();
};

FilterComputeProtocol.prototype.process = function(data) {
  var x = parseInt(data[this.source_field]);
  if (x) {
    try {
      var result = ipProto[x];
      if (result !== undefined && result !== null && (typeof result === 'string' || ! isNaN(result)) && result !== Infinity) {
        data[this.target_field] = result;
      }
    }
    catch(err) {
    }
  }
  return data;
};

exports.create = function() {
  return new FilterComputeProtocol();
};
