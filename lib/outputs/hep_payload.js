var hepjs = require('hep-js'),
	logger = require('log4node');

function mergeHepConfig(component) {
	component.mergeConfig({
		name: 'HEP/EEP Server',
		host_field: 'host',
		port_field: 'port',
		optional_params: ['hep_id', 'hep_pass', 'hep_cid', 'hep_type', 'src_ip', 'src_port', 'dst_ip', 'dst_port', 'hep_payload_type', 'hep_ip_family', 'hep_protocol', 'transaction_type', 'protocol'],
		default_values: {
			protocol: 'udp',
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
			hep_timefield: false,
		},
	});
	component.mergeConfig(component.serializer_config());
}

function preHep(ctx, data) {
	try {
		if (data.rcinfo && data.payload) {
			logger.debug('PRE-PACKED HEP JSON!');
			data.rcinfo.captureId = ctx.hep_id;
			data.rcinfo.capturePass = ctx.hep_pass;
			if (typeof data.payload == 'object') {
				data.payload = JSON.stringify(data.payload);
			}
			return hepjs.encapsulate(data.payload, data.rcinfo);
		}

		var hep_proto = {
			'type': 'HEP',
			'version': 3,
			'payload_type': ctx.hep_payload_type,
			'proto_type': ctx.hep_type,
			'captureId': ctx.hep_id,
			'capturePass': ctx.hep_pass,
			'ip_family': ctx.hep_ip_family,
			'protocol': ctx.hep_protocol
		};

		var datenow = new Date();
		hep_proto.time_sec = data.time_sec || Math.floor(datenow.getTime() / 1000);
		hep_proto.time_usec = data.time_usec || datenow.getMilliseconds() * 1000;
		hep_proto.srcIp = data.srcIp || ctx.src_ip;
		hep_proto.dstIp = data.dstIp || ctx.dst_ip;
		hep_proto.srcPort = data.srcPort || ctx.src_port;
		hep_proto.dstPort = data.dstPort || ctx.dst_port;
		hep_proto.correlation_id = data.correlation_id || '';
		if (ctx.transaction_type) { hep_proto.transaction_type = ctx.transaction_type; }

		if (data.payload) {
			if (typeof data.payload == 'object') {
				data.payload = JSON.stringify(data.payload);
			}
			return hepjs.encapsulate(data.payload, hep_proto);
		}
		hep_proto.payload_type = 100;
		if (typeof data == 'object') {
			data = JSON.stringify(data);
		}
		return hepjs.encapsulate(JSON.stringify(data), hep_proto);
	} catch (e) { logger.error('PREHEP ERROR:', e); }
}

function formatPayload(ctx, data, callback) {
	if (data) {
		callback(preHep(ctx, data));
	}
}

function hepToString(ctx) {
	var transport = (ctx.protocol === 'tcp') ? 'tcp' : 'udp';
	return 'HEP ' + transport + ' to ' + ctx.host + ':' + ctx.port;
}

exports.mergeHepConfig = mergeHepConfig;
exports.preHep = preHep;
exports.formatPayload = formatPayload;
exports.hepToString = hepToString;
