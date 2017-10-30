var base_input = require('../lib/base_input'),
  util = require('util'),
  logger = require('log4node');

var Cap = require('cap').Cap,
    decoders = require('cap').decoders,
    PROTOCOL = decoders.PROTOCOL;

function InputPcap() {
  base_input.BaseInput.call(this);
  this.mergeConfig({
    name: 'pcap',
    optional_params: ['bpf_filter', 'device_ip', 'buf_size', 'debug', 'binary'],
    default_values: {
      buf_size: 10 * 1024 * 1024,
      bpf_filter: 'tcp and dst port 80',
      debug: false,
      binary: false
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
            		this.emit('data', {
                  		'type': 'PCAP',
                  		'proto': 'TCP',
                  		'hdr': hdr,
                  		'message': this.binary ? buffer : buffer.toString('binary', tcpret.offset, tcpret.offset + datalen)
            		});


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
	                  'message': this.binary ? buffer : buffer.toString('binary', udpret.offset, udpret.offset + udpret.info.length)
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
