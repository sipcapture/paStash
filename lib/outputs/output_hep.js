var abstract_udp = require('./abstract_udp'),
  hepjs = require('hep-js'),
  util = require('util'),
  logger = require('log4node');

function OutputHep() {
  abstract_udp.AbstractUdp.call(this);
  this.mergeConfig({
    name: 'Udp',
  });
  this.mergeConfig(this.serializer_config());
  this.mergeConfig({
    name: 'HEP/EEP Server',
    optional_params: ['hep_id', 'hep_pass', 'hep_cid', 'hep_type', 'src_ip', 'src_port', 'dst_ip', 'dst_port', 'hep_payload_type', 'hep_ip_family', 'hep_protocol'],
    default_values: {
      host: '127.0.0.1',
      port: 9063,
      hep_id: '2001',
      hep_pass: 'MyHep',
      hep_cid: '#{correlation_id}',
      hep_type: 1,
      hep_payload_type: 1,
      hep_ip_family: 1,
      hep_protocol: 17,
      src_ip: '127.0.0.1',
      src_port: '0',
      dst_ip: '127.0.0.2',
      dst_port: '0',
      hep_timefield: false
    },
  });
}

util.inherits(OutputHep, abstract_udp.AbstractUdp);

OutputHep.prototype.preHep = function(data) {

  try {
	  // IF HEP JSON
	  if (data.rcinfo && data.payload) {
		logger.debug('PRE-PACKED HEP JSON!');
		data.rcinfo.captureId = this.hep_id;
		data.rcinfo.capturePass = this.hep_pass;
		return hepjs.encapsulate(data.payload,data.rcinfo);
	  }

	  // Default HEP RCINFO
	  var hep_proto = {
	    'type': 'HEP',
	    'version': 3,
	    'payload_type': 1,
	    'proto_type': this.hep_type ? this.hep_type : 100,
	    'captureId': this.hep_id ? this.hep_id : 2001,
	    'capturePass': this.hep_pass ? this.hep_pass : 'paStash',
	    'ip_family': this.hep_ip_family,
	    'protocol': this.hep_protocol
	  };

  	var datenow = (new Date()).getTime();
	hep_proto.time_sec = Math.floor(datenow / 1000);
	hep_proto.time_usec = datenow - (hep_proto.time_sec * 1000);
	// Build HEP3 w/ null network parameters - TBD configurable
  	hep_proto.srcIp = data.srcIp || this.src_ip;
  	hep_proto.dstIp = data.dstIp || this.dst_ip;
  	hep_proto.srcPort = data.srcPort || this.src_port;
  	hep_proto.dstPort = data.dstPort || this.dst_port;
  	// pair correlation id from pattern
	hep_proto.correlation_id = data.correlation_id || '';

	if (data.payload) {
	    // Pack HEP3
	    return hepjs.encapsulate(data.payload,hep_proto);
 	} else {
	    // Pack HEP3 Log Type fallback
	    hep_proto.payload_type = 100;
	    return hepjs.encapsulate(data,hep_proto);
        }

   } catch(e) { logger.error('PREHEP ERROR:',e); }
};

OutputHep.prototype.formatPayload = function(data, callback) {
  if (data) callback(this.preHep(data));
};

OutputHep.prototype.to = function() {
  return 'HEP udp to ' + this.host + ':' + this.port;
};

exports.create = function() {
  return new OutputHep();
};
