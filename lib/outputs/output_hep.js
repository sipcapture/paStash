var base_output = require('../lib/base_output'),
	abstract_udp = require('./abstract_udp'),
	abstract_tcp = require('./abstract_tcp'),
	hep_payload = require('./hep_payload'),
	util = require('util');

function OutputHep() {
	base_output.BaseOutput.call(this);
	this.mergeConfig({
		name: 'HEP/EEP Server',
		host_field: 'host',
		port_field: 'port',
		optional_params: ['protocol'],
		default_values: {
			protocol: 'udp',
		},
		config_hook: this.applyTransport,
	});
}

util.inherits(OutputHep, base_output.BaseOutput);

OutputHep.prototype.applyTransport = function(callback) {
	var useTcp = this.protocol === 'tcp';
	var transport = useTcp ? abstract_tcp.AbstractTcp : abstract_udp.AbstractUdp;
	transport.call(this);
	['startAbstract', 'process', 'close'].forEach(function(name) {
		this[name] = transport.prototype[name];
	}.bind(this));
	if (useTcp) {
		this.findConnection = abstract_tcp.AbstractTcp.prototype.findConnection;
		this.closed_callback = function() {};
	}
	hep_payload.mergeHepConfig(this);
	for (var key in this.config.default_values) {
		if (this[key] === undefined) {
			this[key] = this.config.default_values[key];
		}
	}
	callback();
};

OutputHep.prototype.formatPayload = function(data, callback) {
	hep_payload.formatPayload(this, data, callback);
};

OutputHep.prototype.to = function() {
	return hep_payload.hepToString(this);
};

exports.create = function() {
	return new OutputHep();
};
