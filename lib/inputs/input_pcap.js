var base_input = require('../lib/base_input'),
  util = require('util'),
  logger = require('log4node');

var Cap = require('cap').Cap,
    decoders = require('cap').decoders,
    PROTOCOL = decoders.PROTOCOL;


/* SSL Goodies */

var SSL_MIN_GOOD_VERSION = 0x002,
 SSL_MAX_GOOD_VERSION = 0x304,
 TLS_HANDSHAKE = 22,
 TLS_APPLICATION_DATA = 23,
 TLS_CLIENT_HELLO = 1,
 TLS_SERVER_HELLO = 2,
 TLS_CERTIFICATE = 11,
 TLS_CLIENT_KEY_EXCHANGE = 16,
 TLS_CERTIFICATE = 11,
 TLS_FINISHED = 20,
 OFFSET_HELLO_VERSION = 9,
 OFFSET_SESSION_LENGTH = 43,
 OFFSET_CIPHER_LIST = 44;


function ssl_version(version) {
	switch (version) {
		case 0x002: return "SSLv2";
		case 0x300: return "SSLv3";
		case 0x301: return "TLSv1";
		case 0x302: return "TLSv1.1";
		case 0x303: return "TLSv1.2";
	}
}

function InputPcap() {
  base_input.BaseInput.call(this);
  this.mergeConfig({
    name: 'pcap',
    optional_params: ['bpf_filter', 'device_ip', 'buf_size', 'debug', 'output_format'],
    default_values: {
      buf_size: 10 * 1024 * 1024,
      bpf_filter: 'tcp and dst port 80',
      debug: false,
      output_format: 'base64' // 'utf8', 'binary', 'buffer'
    },
    start_hook: this.start,
  });
}

util.inherits(InputPcap, base_input.BaseInput);

InputPcap.prototype.start = function(callback) {

  this.c = new Cap();
  var device = this.device_ip ? Cap.findDevice(this.device_ip) : Cap.findDevice();
  var filter = this.bpf_filter;
  var bufSize = this.buf_size;
  var buffer = new Buffer(65535);

  var linkType = this.c.open(device, filter, bufSize, buffer);
  this.c.setMinBytes && this.c.setMinBytes(0);

  this.c.on('packet', function(nbytes, trunc) {
    if (this.debug) logger.info('packet: length ' + nbytes + ' bytes, truncated? ' + (trunc ? 'yes' : 'no'));

    try {
     if (linkType === 'ETHERNET') {
     var ret = decoders.Ethernet(buffer);
     if (this.debug) logger.info(ret);
	var hdr = {};
        if (ret.info.type === PROTOCOL.ETHERNET.IPV4) {
          if (this.debug) logger.info('Decoding IPv4 ...');
		ret = decoders.IPV4(buffer, ret.offset);
		if (ret.info.protocol === PROTOCOL.IP.TCP) {
			/* TCP DECODE */
		        var datalen = ret.info.totallen - ret.hdrlen;
		        if (this.debug) logger.info('Decoding TCP ...');
		        var tcpret = decoders.TCP(buffer, ret.offset);
		        if (this.debug) logger.info(' TCP from: ' + ret.info.srcip + ':' + tcpret.info.srcport + ' to: ' + ret.info.dstaddr + ':' + tcpret.info.dstport);
		        datalen -= tcpret.hdrlen;
				hdr.srcip = ret.info.srcip;
				hdr.dstip = ret.info.dstip;
				hdr.srcport = tcpret.info.srcport;
				hdr.dstport = tcpret.info.dstport;

			var payload = buffer.slice(tcpret.offset,tcpret.offset + datalen);
			if (payload[0] == TLS_HANDSHAKE) {
				var decode = {
					proto_version: payload[1]*256 + payload[2],
					ssl_version: ssl_version(payload[1]*256 + payload[2]),
					hello_version: payload[OFFSET_HELLO_VERSION]*256 + payload[OFFSET_HELLO_VERSION+1]
				};

				if (decode.ssl_version < SSL_MIN_GOOD_VERSION || decode.ssl_version >= SSL_MAX_GOOD_VERSION) {
					logger.error('Unsupported SSL version!', decode.ssl_version);
					return;
				}
				var cipher_data = payload[OFFSET_SESSION_LENGTH];
				if (datalen < OFFSET_SESSION_LENGTH + cipher_data[0] + 3) {
					logger.error('SSL ID too long!');
					return;
				}

				cipher_data += 1 + cipher_data[0];
        	    		this.json = {
	                  	    'type': 'PCAP',
                	  	    'proto': 'TLS',
                	  	    'hdr': hdr,
				    'tls' : decode
				};

				switch (payload[5]) {
					case TLS_CLIENT_HELLO:
						logger.info("ClientHello ", ssl_version(decode.hello_version));
						this.json.payload = "CLIENT_HELLO";
						var cs_len = cipher_data[0]*256 + cipher_data[1];
						cipher_data += 2; // skip cipher suites length
						// FIXME: check for buffer overruns
						var cs_id;
						for (cs_id = 0; cs_id < cs_len/2; cs_id++)
							logger.info("cipher",cipher_data[2*cs_id], cipher_data[2*cs_id + 1]);
						break;
					case TLS_SERVER_HELLO:
						logger.info("TLS ServerHello ", ssl_version(decode.hello_version));
						this.json.payload = "SERVER_HELLO";
						logger.info("cipher:", cipher_data[0], cipher_data[1]);
						break;
					case TLS_CLIENT_KEY_EXCHANGE:
						logger.info("TLS Client Key Exchange", ssl_version(decode.hello_version));
						this.json.payload = "CLIENT_KEY_EXCHANGE";
						break;
					case TLS_FINISHED:
						logger.info("TLS Finished", ssl_version(decode.hello_version));
						this.json.payload = "FINISHED";
						break;
					default:
						logger.info("Not a Hello",payload[5]);
						return;
				}

			} else if (payload[0] == TLS_APPLICATION_DATA) {

            		  this.json = {
                  	    'type': 'PCAP',
                  	    'proto': 'TLS',
                  	    'payload': 'APPLICATION_DATA',
                  	    'hdr': hdr,
                  	    'message': this.output_format == 'buffer' ? buffer.slice(tcpret.offset,tcpret.offset + datalen) : buffer.toString(this.output_format, tcpret.offset, tcpret.offset + datalen)
            		  };

			} else {
            		  this.json = {
                  	    'type': 'PCAP',
                  	    'proto': 'TCP',
                  	    'hdr': hdr,
                  	    'message': this.output_format == 'buffer' ? buffer.slice(tcpret.offset,tcpret.offset + datalen) : buffer.toString(this.output_format, tcpret.offset, tcpret.offset + datalen)
            		  };
			}
            		this.emit('data', this.json);


		} else if (ret.info.protocol === PROTOCOL.IP.UDP) {
			/* UDP DECODE */
		        if (this.debug) logger.info('Decoding UDP ...');
		        var udpret = decoders.UDP(buffer, ret.offset);
		        if (this.debug) logger.info(' UDP from: ' + ret.info.srcaddr + ':' + udpret.info.srcport + ' to: ' + ret.info.dstaddr+ ':' + udpret.info.dstport);
				hdr.srcip = ret.info.srcaddr;
				hdr.dstip = ret.info.dstaddr;
				hdr.srcport = udpret.info.srcport;
				hdr.dstport = udpret.info.dstport;
			this.emit('data', {
	                  'type': 'PCAP',
	                  'proto': 'UDP',
	                  'hdr': hdr,
	                  'message': this.output_format == 'buffer' ? buffer.slice(udpret.offset,tcpret.offset + datalen) : buffer.toString(this.output_format, udpret.offset, udpret.offset + udpret.info.length)
	            	});

		}  else {
		        if (this.debug) logger.info('Unsupported IPv4 protocol: ' + PROTOCOL.IP[ret.info.protocol]);
		}
	} else {
	  if (this.debug) logger.debug('Unsupported Ethertype: ' + PROTOCOL.ETHERNET[ret.info.type]);
	}
     }
    } catch(e) { logger.error('Error Processing PCAP Packet!', e); }
  }.bind(this));
  callback();
};

InputPcap.prototype.close = function(callback) {
  logger.info('Closing PCAP');
  if (this.c) {
    this.c.close();
  }
  callback();
};

exports.create = function() {
  return new InputPcap();
};
