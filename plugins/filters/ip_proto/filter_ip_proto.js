/*
   Port to Protocol plugin for @pastash/pastash
   (C) 2024 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

function FilterIPProto() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'ip_proto',
    optional_params: ['target_field', 'custom'],
    host_field: 'source_field',
    debug: false,
    default_values: {
      'debug': false,
      'custom': false,
    },
    start_hook: this.start.bind(this)
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
	53:  "dns",
	56:  "tlsp",
	58:  "icmp-v6",
	80:  "http",
	89:  "ospf",
	94:  "ipip",
	123: "ntp",
	132: "sctp",
	443: "https",
};

util.inherits(FilterIPProto, base_filter.BaseFilter);

FilterIPProto.prototype.start = function(callback) {
 if (!this.target_field) {
    this.target_field = this.source_field;
  }
  if (this.custom) {
    var pairs = this.custom.split(',');
    pairs.forEach(pair => {
        let [ip, proto] = pair.split(':');
	ipProto[parseInt(ip)] = proto;
    });
  }

  logger.info('Initializing IP protocol filter from', this.source_field, 'to', this.target_field);
  callback();
};

FilterIPProto.prototype.process = function(data) {
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
  return new FilterIPProto();
};
