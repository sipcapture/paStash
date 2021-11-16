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
    optional_params: ['hep_id', 'hep_pass', 'hep_cid', 'hep_type', 'src_ip', 'src_port', 'dst_ip', 'dst_port', 'hep_payload_type', 'hep_ip_family', 'hep_protocol', 'transaction_type'],
    default_values: {
      host: '127.0.0.1',
      port: 9063,
      hep_id: '2001',
      hep_pass: 'MyHep',
      hep_cid: '#{correlation_id}',
      hep_type: 100,
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
	  };

	  // Default HEP RCINFO
	  var hep_proto = {
	    'type': 'HEP',
	    'version': 3,
	    'payload_type': this.hep_payload_type,
	    'proto_type': this.hep_type,
	    'captureId': this.hep_id,
	    'capturePass': this.hep_pass,
	    'ip_family': this.hep_ip_family,
	    'protocol': this.hep_protocol
	  };
	  
  	var datenow = new Date();
	hep_proto.timeSeconds = data.time_sec || Math.floor(datenow.getTime() / 1000);
	hep_proto.timeUSeconds = data.time_usec || datenow.getMilliseconds();
	// Build HEP3 w/ null network parameters - TBD configurable
  	hep_proto.srcIp = data.srcIp || this.src_ip;
  	hep_proto.dstIp = data.dstIp || this.dst_ip;
  	hep_proto.srcPort = data.srcPort || this.src_port;
  	hep_proto.dstPort = data.dstPort || this.dst_port;
  	// pair correlation id from pattern
	hep_proto.correlation_id = data.correlation_id || '';
	// Optional Transaction Type
	if (this.transaction_type) { hep_proto.transaction_type = this.transaction_type; }
	  
	if (data.payload) {
	    // Pack HEP3
	    return hepjs.encapsulate(JSON.stringify(data.payload),hep_proto);
 	} else {
	    // Pack HEP3 Log Type fallback
	    hep_proto.payload_type = 100;
	    return hepjs.encapsulate(JSON.stringify(data),hep_proto);
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
