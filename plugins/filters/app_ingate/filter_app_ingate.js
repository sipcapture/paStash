/*
   Custom, Slightly optimized Ingate Syslog to SIP/HEP3 Parser w/ reassembly of rows
   (C) 2019 Systemcrash
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;


var ansicolours = true;

if (ansicolours) {
	var ansired = "\u001B[31m";
	var ansireset = "\u001B[0m";
} else {
	var ansired = "";
	var ansireset = "";
}

var appName = "AppIngate";
var appNameLong = "AppIngate Syslog to SIP/HEP parser";

function FilterAppIngate() {
	base_filter.BaseFilter.call(this);
	this.mergeConfig({
		name: ansired + appName + ansireset,
		optional_params: ['correlation_hdr', 'debug'],
		default_values: {
			//include short form of Call-ID: --> i:
			'correlation_hdr': '(?:[Cc]all-[Ii][Dd]\:|i\:)',
			'debug': false
		},
		start_hook: this.start,
	});
}

util.inherits(FilterAppIngate, base_filter.BaseFilter);

FilterAppIngate.prototype.start = function(callback) {
	logger.info('Initialized ' + ansired + appNameLong + ansireset);
	callback();
};

var last = '';
var ipcache = {}; //IP cache is global param - successive (related) log lines will re-use the cache.
var hold = false; //?
var sip = '';


FilterAppIngate.prototype.process = function(data) {

	var line = data.message;
	if (this.debug) {
		console.log('> Function ingested data:', data);
	}
	if (line.indexOf('send s') !== -1) {
		/* this is the regex which will match log messages for all egress SIP */
		//they normally look like this via syslog - note, syslog only sends single rows at a time:
		//<30>Jul 12 16:59:53 netlogger: Info: sipfw: send sf (0x1381b50) to 4.8.12.4:5061 via 1.1.1.1:6005 TLS connection 2:
		//otherwise (taken from HTML logs) - sf = stateful, sl = stateless:
		//Info: sipfw: send sf (0xcf4310) to 4.8.12.4:5061 via 1.1.1.1:6005 TLS connection 3:
		//Info: sipfw: send sl (0xcf4310) to 4.8.12.4:5061 via 8.8.8.8:6005 TLS connection 3:


		var regex = /send\ss[fl](?:\s\(0x.*\))?\sto\s(.*):(.*)\svia\s(.*):([^\s]+)\s(\w+)\sconnection\s\d+\:/;
		var ip = regex.exec(line);
		ipcache.srcIp = ip[3];
		ipcache.srcPort = ip[4];
		ipcache.dstIp = ip[1];
		ipcache.dstPort = ip[2];
		ipcache.proto = ip[5];
		//at this point, pull the timestamp of the syslog msg - we wont find it embedded in the logs
		dt = new Date(data['@timestamp']).getTime();

		ipcache.xdate = dt;

		if (this.debug) {
			console.log('out', ipcache);
			console.log(' line for egress:', line);
			console.log('>end line for egress.');
		}

	} else if (line.indexOf('recv') !== -1) {
		/* this is the regex which will match log messages for all ingress SIP */
		//they normally look like this via syslog - note, syslog only sends single rows at a time:
		//<30>Jul 12 16:59:53 netlogger: Info: sipfw: recv from 4.8.12.4:5061 via 1.1.1.1:6005 TLS connection 2:
		//otherwise (taken from HTML logs):
		//Info: sipfw: recv from 4.8.12.4:5061 via 1.1.1.1:6005 TLS connection 3:

		var regex = /recv\sfrom\s(.*):(.+)\svia\s(.*):(.+)\s(\w+)\sconnection\s\d+\:/i;
		var ip = regex.exec(line);
		ipcache.srcIp = ip[1];
		ipcache.srcPort = ip[2];
		ipcache.dstIp = ip[3];
		ipcache.dstPort = ip[4];
		ipcache.proto = ip[5];
		dt = new Date(data['@timestamp']).getTime();

		ipcache.xdate = dt;
		if (this.debug) {
			console.log('in', ipcache);
			console.log(' data for ingress:', line);
			console.log('>end data for ingress.');
		}
	}
	if (line.includes("        ") && (line.includes(" SIP/2.0") || line.includes("SIP/2.0 "))) {
		//Found SIP signalling indented with space

		//console.log('Got: ' + line + ' length: ',line.length);

		//i.e. we found SIP rows in syslog
		if (line.length > 1) {

			var lines = line.split('\n');
			/*
			if (lines.length > 1 )
			{	//we were fed multiple syslog lines.
				//console.log('lines are: ',lines.length);
			}
			else
			{	//we were fed single syslog lines. forgot multiline filter?
				console.log('Please enable multi-line filter \:\/');
			}
			*/

			/* regex here captures the syslog lines with SIP content. 
			Content looks like: 
			'<134>May 27 02:52:53 netlogger:              SIP/2.0 200 OK'
			or
			'<134>May 27 02:52:53 netlogger:'
			*/
			var regex = /(?:\:\s{14}(.*)|(:))$/;
			var bailout = /Debug: sipfw:|Info: sipfw:/;

			var output = "";
			for (var i = 0; i < lines.length; i++) {
				var msg = regex.exec(lines[i]);
				var bailtest = bailout.test(lines[i]);

				if (i > 2 && bailtest) {
					//we've rolled past end of SIP msg into logs. Stop.
					break;
				}

				if (msg !== null && msg[1] !== undefined) {
					//console.log('p:', msg[1], '<' );
					//HEP, heplify Go parser and valid SIP wants \r\n, CR/LF, add it here
					output += msg[1] + '\r\n';
				}
				if (i > 2 && msg !== null && msg[2] !== undefined) {
					//capture group 2 corresponds to ...|(:)
					//pretty sure this is the first \r\n SDP row
					//console.log('msg2: ', msg[2]);
					output += '\r\n';
				}

			}

			var sip = output;
			if (this.debug) {
				console.log('SIP>', sip);
			}
			output = '';

		}
		/* else {
		console.log('got single syslog row:', line);
		}  */


		var ts = ipcache.xdate / 1000;
		ts = parseInt(ts.toFixed(0));
		var ts_microsec = ipcache.xdate * 1000;

		var rcinfo = {
			type: 'HEP',
			version: 3,
			payload_type: 1,
			ip_family: 2,
			protocol: ipcache.proto == 'UDP' ? 17 : 6,
			proto_type: 1,
			correlation_id: '',
			srcIp: ipcache.srcIp,
			srcPort: ipcache.srcPort,
			dstIp: ipcache.dstIp,
			dstPort: ipcache.dstPort,
			time_sec: ts || '',
			time_usec: ts_microsec || ''
		};

		// EXTRACT CORRELATION HEADER, IF ANY
		if (this.correlation_hdr) {
			var xcid = sip.match(this.correlation_hdr + '\\s?(.*)\\r?\\n?');
			if (xcid && xcid[1]) {
				//console.log('Found: ',xcid);
				rcinfo.correlation_id = xcid[1].trim();
				xcid = xcid[0];
			}
		}

		if (sip && rcinfo) {
			console.log(ansired + appNameLong + ansireset + "; SIP/HEP payload assembled; " + xcid);
			return {
				payload: sip,
				rcinfo: rcinfo
			};
		}


		/*
		if ( data.message ) {
			console.log('have data');
		} */
		/* else {
		//just syslog
		data.xdate = new Date(data['@timestamp']).getTime();
		var ts = data.xdate / 1000;
		ts = parseInt( ts.toFixed(0) );
		var ts_microsec = data.xdate * 1000;
		var rcinfo = {
			type: 'HEP',
			version: 3,
			payload_type: 100,
			ip_family: 2,
			protocol: data.udp_port ? 17 : 6,
			proto_type: 1,
			correlation_id: '',
			srcIp: data.host,
			srcPort: data.udp_port ? data.udp_port : data.tcp_port,
			,
			dstIp: '',
			dstPort: '',
			time_sec: ts || '',
			time_usec: ts_microsec || ''
		};
		if (rcinfo && data) {
			return {
				payload: data,
				rcinfo: rcinfo
			};
		}
		} */

	}
};

exports.create = function() {
	return new FilterAppIngate();
}; 
