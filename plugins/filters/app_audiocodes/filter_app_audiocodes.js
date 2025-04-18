/*
   Custom, Unoptimized Audiocodes Log to SIP/HEP3 Parser w/ reassembly of rows
   (C) 2020 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
    util = require('util'),
    logger = require('@pastash/pastash').logger

var fs = require('fs'), 
    ini = require('ini')

var LRU = require("lru-cache"), 
    sid_cache = new LRU(1000),
    expire = 10000 * 60 * 60

var self

function FilterAppAudiocodes() {
    base_filter.BaseFilter.call(this);
    this.mergeConfig({
    name: 'AppAudiocodes',
    optional_params: ['correlation_hdr','bypass', 'debug', 'logs', 'localip', 'localport', 'correlation_contact', 'qos', 'autolocal', 'version', 'ini', 'iniwatch'],
    default_values: {
        'correlation_contact': false,
        'correlation_hdr': false,
        'debug': false,
        'bypass': false,
        'logs': false,
        'qos': true,
        'autolocal': false,
        'localip': '127.0.0.1',
        'localport': 5060,
        'version': '7.40A.500',
        'ini': false,
        'iniwatch': false
    },
    start_hook: this.start,
    });
}

util.inherits(FilterAppAudiocodes, base_filter.BaseFilter);

FilterAppAudiocodes.prototype.start = function(callback) {
    logger.info('Initialized App Audiocodes SysLog to SIP/HEP parser');
    self = this;
    if (this.ini) {
        logger.info('Reading INI file to resolver...', this.ini);
        try {
            this.resolver = parseIni(this.ini);
            logger.info('INI Loaded '+this.resolver.interfaces.lenght +' Interfaces');
            logger.info('INI Loaded '+this.resolver.sip.lenght +' SIP Profiles');
            if (this.debug) console.log(this.resolver);
            if (this.iniwatch) watchIni(this.ini, this.resolver);
        } catch(err) { logger.error(err) }
    }

    callback();
};

/**
 * Session Manager
 * Object to manage SIP Sessions in cache
 */
let sessionManager = {}

/**
 * Checks current buffer for SIP Messages
 * @param {string[]} buffer 
 * @returns {Promise<void>}
 */
sessionManager.checkBuffer = async function (buffer) {
    let searchComplete = false;
    let offset = 0;
    let rawSIP = [];
    while (!searchComplete) {
        let line = buffer[offset]
        if (this.debug) console.log("-> Checking line with buffer offset", offset, line)
        if (line.includes('(N ')) {
            if (this.debug) console.log('-> Found header message')
            rawSIP.push(line)
        }
        let nextLine = buffer[offset + 1]
        if (nextLine) {
            if (nextLine.includes('(N ')) {
                searchComplete = true
                udpBuffer.buffer = buffer.slice(offset+1)
                if (this.debug) console.log(`--> Complete SIP Message found, processing ${rawSIP.length} lines`)
                sessionManager.checkSIP(rawSIP)
            } else {
                if (this.debug) console.log('--> More SIP parts found')
                rawSIP.push(nextLine)
                offset++
            }
        } else {
            searchComplete = true
            if (line.includes('#012#012 [')) {
                searchComplete = true
                udpBuffer.buffer = buffer.slice(offset+1)
                if (this.debug) console.log(`---> Complete SIP Message found, processing ${rawSIP.length} lines`)
                sessionManager.checkSIP(rawSIP)
            }
            if (this.debug) console.log('---> XX - End of buffer reached, waiting for more data')
            break
        }
    }
    return
}

/**
 * Check if message is SIP and route accordingly
 * @param {string[]} rawSIP 
 * @returns {Promise<void>}
 */
sessionManager.checkSIP = async function (rawSIP) {
    let header = rawSIP.shift()
    let message = rawSIP.join('')
    
    if (this.debug) console.log('Checking SIP Message', header, message)
    /* Extract SID and SEQ from SIP Message */
    var sidObj = /\[SID=(?<sid>.*?)\]/.exec(header)
    /* Check if this message belongs to SIP */
    if (!sidObj) {
        if (this.bypass) return {header, message}
        logger.error(`❌ Invalid SIP Message, missing SID or SEQ in Line: ${header + message}`)
        logger.error('ℹ️ If you believe this message would be helpful to you, create an issue and the above output in the paStash repository.')
        /* TODO: Reimplement NON-SIP processing, need examples */
        return
    }
    /* Check if this message has SIP inside (to catch routing only message) */
    if (message.length < 1) {
        logger.error('❌ No SIP content found', header, rawSIP)
        return
    }
    /* Clean up messages */
    message = message.replace(/\[S=[0-9]*\] \[SID=[a-zA-Z:0-9]*\]  /gi, '')
    message = message.replace(/ \[Time:[0-9\-@:\.]*\] \[[0-9]*\]/gi, '')
    if (!message.match(/#012#012$/)) {
        message += '#012#012'
    } else {
        message += '#012'
    }
    message = message.replace(/#012/g, '\r\n')
    if (this.debug) console.log('📞 SIP Message :');
    if (this.debug) console.log(message);
    /* process SIP Message */
    sessionManager.processSip(header, message, sidObj[1])
}

/**
 * Create rcInfo and SIP Message
 * @param {string} header 
 * @param {string} message
 * @param {string} sid
 * @returns {Promise<void>}
 */
sessionManager.processSip = async function (header, message, sid) {
    let direction = 'incoming'
    if (header.includes('Outgoing SIP Message')) {
        direction = 'outgoing'
    }
    if (this.debug) console.log('Direction', direction)

    let resolved = false
    try {
        if (self.resolver){
            resolved = self.invokeResolver(header)
        }
    } catch (err) {
        logger.error(err, header)
    }
    if (self.debug) console.log('Resolved Object', resolved)

    let datenow = new Date().getTime();
    let time_sec = Math.floor( datenow / 1000);
    let time_usec = (datenow - (time_sec*1000))*1000;

    var rcinfo = {
        type: 'HEP',
        version: 3,
        payload_type: 1,
        ip_family: 2,
        protocol: 17,
        proto_type: 1,
        correlation_id: '',
        srcIp: '127.0.0.1',
        srcPort: 5060,
        dstIp: '127.0.0.1',
        dstPort: 5060,
        time_sec: time_sec,
        time_usec: time_usec
    }

    let otherPartyIp = header.match(/(?:Incoming|Outgoing) SIP Message (?:from|to) (?<ip>.*) (?:from|to)/)
    otherPartyIp = otherPartyIp ? otherPartyIp.groups.ip : false
    otherPartyIp = otherPartyIp.split(':')

    if (resolved && resolved?.xlocalip && resolved?.xlocalport){
        if (direction === 'incoming') {
            rcinfo.dstIp = resolved.xlocalip
            rcinfo.dstPort = parseInt(resolved.xlocalport)
            rcinfo.srcIp = otherPartyIp[0] || self.localip
            rcinfo.srcPort = parseInt(otherPartyIp[1]) || parseInt(self.localport)
        } else {
            rcinfo.srcIp = resolved.xlocalip
            rcinfo.srcPort = parseInt(resolved.xlocalport)
            rcinfo.dstIp = otherPartyIp[0] || self.localip
            rcinfo.dstPort = parseInt(otherPartyIp[1]) || parseInt(self.localport)
        }
    } else if (resolved && resolved?.groups?.alias) {
        // convert alias to IP:port 
        if (direction === 'incoming') {
            rcinfo.dstIp = aliases[0] || self.localip
            rcinfo.dstPort = parseInt(aliases[1]) || parseInt(self.localport)
            rcinfo.srcIp = otherPartyIp[0] || self.localip
            rcinfo.srcPort = parseInt(otherPartyIp[1]) || parseInt(self.localport)
        } else {
            rcinfo.srcIp = aliases[0] || self.localip
            rcinfo.srcPort = parseInt(aliases[1]) || parseInt(self.localport)
            rcinfo.dstIp = otherPartyIp[0] || self.localip
            rcinfo.dstPort = parseInt(otherPartyIp[1]) || parseInt(self.localport)
        }
    } else {
        if (this.debug) console.log('No resolver found, using default local IP and Port')
        if (direction === 'incoming') {
            rcinfo.dstIp = self.localip
            rcinfo.dstPort = parseInt(self.localport)
            rcinfo.srcIp = otherPartyIp[0] || self.localip
            rcinfo.srcPort = parseInt(otherPartyIp[1]) || parseInt(self.localport)
        } else {
            rcinfo.srcIp = self.localip
            rcinfo.srcPort = parseInt(self.localport)
            rcinfo.dstIp = otherPartyIp[0] || self.localip
            rcinfo.dstPort = parseInt(otherPartyIp[1]) || parseInt(self.localport)
        }
    }

    let callid = message.match(/call-id:\s?(.*?)\s?\r\n/i) || [];

    rcinfo.callId = callid[1] || sid || '';
    rcinfo.correlation_id = callid[1] || sid || '';

    if (self.correlation_hdr && rcinfo.proto_type == 1 && message.startsWith('INVITE')) {
        var xcid = message.match(self.correlation_hdr+":\s?(.*)\r\n\r\n")
        if (xcid && xcid[1]) rcinfo.correlation_id = xcid[1].trim()
        if (this.debug) logger.info('auto correlation pick', rcinfo.correlation_id)
    }

    if (self.correlation_contact && rcinfo.proto_type == 1 && message.startsWith('INVITE')) {
        var extract = /x-c=(.*?)\//.exec(message)
        if (extract[1]) {
            rcinfo.correlation_id = extract[1]
           if (this.debug) logger.info('auto correlation pick', rcinfo.correlation_id)
        }
    }

    if (message.indexOf('2.0/TCP') !== -1 || message.indexOf('2.0/TLS') !== -1 ){
        rcinfo.protocol = 6;
        if (this.autolocal) rcinfo.dstPort = 5061
    }

    self.emit('output', { payload: message, rcinfo: rcinfo })
}


/**
 * UDP Buffer Module
 */
let udpBuffer = {}

/**
 * Buffer Array
 * @type {string[]}
 */
udpBuffer.buffer = []

/**
 * Receive and sort UDP Messages
 * @param {string} message 
 * @returns 
 */
udpBuffer.addUDPMessage = function (message) {
    if (this.debug) console.log('Adding UDP Message to Buffer', message)
    udpBuffer.buffer.push(message)
    udpBuffer.buffer = udpBuffer.buffer.sort(udpBuffer.sortBuffer)
    if (udpBuffer.buffer.length > 100000) {
        console.warn('UDP Buffer is filling up, removing oldest message')
        udpBuffer.buffer.shift()
    }
}

/**
 * Sort Function for sorting by Sequence Number
 * @param {message} a 
 * @param {message} b 
 * @returns {integer} -1, 0, 1
 */
udpBuffer.sortBuffer = function (a, b) {
    let seqA = /.*\[S=(?<seq>[0-9]+)\].*/.exec(a)
    let seqB = /.*\[S=(?<seq>[0-9]+)\].*/.exec(b)
    return parseInt(seqA[1]) - parseInt(seqB[1])
}


var aliases = {};

/**
 * Agnostic SIP Message Regexp
 * @type {RegExp} Agnostic SIP check
 */
const agnostic = new RegExp(/(?:\(N.*)---- (?:Incoming|Outgoing) SIP Message (?:from|to) (?<ip>.*) (?:from|to) SIPInterface #[0-9]+? \((?<alias>.*)\) (?:.*) TO[(]?#[0-9]+?[)]? (?:.*)?---[-]?[ ]?(?:#012)?(?<sip>.*)*/)

/**
 * Receives a buffer from an input or filter
 * @param {buffer} data 
 * @returns {object} processed data
 */
FilterAppAudiocodes.prototype.process = function(data) {
	var line = data.message.toString('utf8')

	if (this.debug) console.info('DEBUG', line)

    /* Remove brinary prefix */
    try {
        line = line.split(/<\d+>/)[1]
    } catch (err) {
        logger.error('Unknown Event or malformed line')
        logger.error(data.message.toString())
        if (this.debug) console.log('ERROR', err)
        return
    }

    /* Prepare line for processing */
	line = line.replace(/\r\n/g, '#012')
    udpBuffer.addUDPMessage(line)
    sessionManager.checkBuffer(udpBuffer.buffer)
    
}

exports.create = function() {
    return new FilterAppAudiocodes()
}

/** UNUSED - REFERENCE FOR TODO ITEM TO REIMPLEMENT NON-SIP */
FilterAppAudiocodes.prototype.sipRouter = function(session, message) {

    /** UNUSED - REFERENCE FOR TODO ITEM TO REIMPLEMENT NON-SIP */
    if (this.debug) console.log('Routing SIP Session', session.sid)

    if (message.indexOf('Incoming SIP Message') !== -1) {
        if (this.debug) console.log('Incoming SIP Message')
        try {
            let resolvedObj = false
            if (this.resolver){
                resolvedObj = this.invokeResolver(session)
            }
            // Apply Regexp to line 
            var rawSIP = agnostic.exec(message) 
            if (!rawSIP || !rawSIP?.groups?.sip) {
                if (this.debug) console.log('MISSING SIP')
                if (this.debug) console.log( message)
                return
            } else  {
                return this.handleSIP(session, rawSIP, 'incoming', resolvedObj)
            }
        } catch (err) {
            logger.error(err, message)
        }
    } else if (message.indexOf('Outgoing SIP Message') !== -1) {
        if (this.debug) console.log('Outgoing SIP Message')
        try {
            let resolvedObj = false
            if (this.resolver) {
                resolvedObj = this.invokeResolver(session)
            }
            // Apply Regexp to line 
            var rawSIP = agnostic.exec(message)
            if (!rawSIP || !rawSIP?.groups?.sip) {
                if (this.debug) console.log('MISSING SIP')
                if (this.debug) console.log( message)
                return
            } else  { 
                return this.handleSIP(session, rawSIP, 'outgoing', resolvedObj)
            }
        } catch (err) {
            logger.error(err, message)
        }
    } else if (this.autolocal && message.indexOf('Local IP Address =') !== -1) {
        console.log('Local IP Address')
        var local = message.match(/Local IP Address = (.*?):(.*?),/) || []
        if (local[1]) this.localip   = local[1]
        if (local[2]) this.localport = local[2]
    } else if (message.indexOf('CALL_END ') !== -1) {
        console.log('CALL_END')
        // Parser TBD page 352 @ https://www.audiocodes.com/media/10312/ltrt-41548-mediant-software-sbc-users-manual-ver-66.pdf
        var cdr = message.split(/(\s+\|)/).filter( function(e) { return e.trim().length > 1; } )
        session.callId = cdr[3] || ''
        if (this.debug) logger.info('CALL_END', cdr, session)
        if (this.logs) return this.postProcess(session,JSON.stringify(cdr),100)
    } else if (message.indexOf('MEDIA_END ') !== -1) {
        console.log('MEDIA_END')
        // Parsed TBD page 353 @ https://www.audiocodes.com/media/10312/ltrt-41548-mediant-software-sbc-users-manual-ver-66.pdf
        var qos = session.currentMessage.split(/(\s+\|)/).filter( function(e) { return e.trim().length > 1; } )
        if (qos.length == 25){
            qos.splice(15, 1);
            qos.splice(5, 1);
        }
        logger.info('!!!!!!!!!!!!!! DEBUG MEDIA', qos, qos.length);
        if (qos && qos[2] && qos[21]){
            session.callId = qos[2] || '';
            var response = [];
            // A-LEG
            session.srcIp = qos[7];
            session.srcPort = parseInt(qos[8]);
            session.dstIp = qos[9];
            session.dstPort = parseInt(qos[10]);
            var local_report = {
                "CORRELATION_ID": qos[2],
                "RTP_SIP_CALL_ID": qos[2],
                "MOS": 4.5 * parseInt(qos[17]) / 127,
                "TOTAL_PK": parseInt(qos[11]),
                "CODEC_NAME": qos[5],
                "DIR":0,
                "REPORT_NAME": qos[4] + "_" + qos[7] + ":" + qos[8],
                "PARTY":0,
                "TYPE":"HANGUP"
            };
            response.push(this.postProcess(session,JSON.stringify(local_report),35));
            // B-LEG
            session.srcIp = qos[9];
            session.srcPort = parseInt(qos[10]);
            session.dstIp = qos[7];
            session.dstPort = parseInt(qos[8]);
            var remote_report = {
                "CORRELATION_ID": qos[2],
                "RTP_SIP_CALL_ID": qos[2],
                "MOS": 4.5 * parseInt(qos[18]) / 127,
                "TOTAL_PK": parseInt(qos[12]),
                "CODEC_NAME": qos[5],
                "DIR":1,
                "REPORT_NAME": qos[4] + "_" + qos[9] + ":" + qos[10],
                "PARTY":1,
                "TYPE":"HANGUP"
            };
            response.push(this.postProcess(session,JSON.stringify(remote_report),35));
            if (this.debug) logger.info('MEDIA_END', response);
            if (this.qos) return response;
        } else {
            logger.error('Missing media parameters', qos);
        }
    } else if (session.sid && this.logs) {
        if (this.bypass) return data;
        // Prepare SIP LOG
        if (this.logs) {
            var callid = message.match(/call-id:\s?(.*?)\s?#012/i) || []
            session.callId = callid[1] || session.sid || ''
            session.srcIp = this.localip || '127.0.0.1'
            session.srcPort = 514
            session.dstIp = this.localip || '127.0.0.1'
            session.dstPort = 514
            sessionManager.removeFragment(session, message)
            return this.postProcess(session, message, 100)
        }
    } else {
        if (this.bypass) return data
        if (this.debug) console.log('UNKNOWN', session.sid, message)
        // Prepare unknown as log
        if (this.logs) {
            var callid = message.match(/call-id:\s?(.*?)\s?#012/i) || []
            session.callId = callid[1] || session.sid || ''
            session.srcIp = this.localip || '127.0.0.1'
            session.srcPort = 514
            session.dstIp = this.localip || '127.0.0.1'
            session.dstPort = 514
            sessionManager.removeFragment(session, message)
            return this.postProcess(session, message, 100)
        }
    }
}

/**
 * Resolves interface names to IP addresses based on Audiocodes INI file
 * @param {string} header 
 * @returns {{alias:string, group:string, proto:string, ifname:string, xlocalip:string, xlocalport:string}}
 */
FilterAppAudiocodes.prototype.invokeResolver = function(header) {
    if (this.debug) console.log('Invoking Resolver')
    let aliasregex = /SIPInterface #([^\s]+) \((.*)\) (.*) TO/g;
    let interface = aliasregex.exec(header) || false;
    if (this.resolver && interface){
        let alias = interface[1]; //0
        let group = interface[2]; //some-group
        let proto = interface[3]; //UDP,TCP,TLS
        let xlocalip = "127.0.0.1"
        let xlocalport = "5060"
        let ifname = this.resolver.sip[group] ? this.resolver.sip[group].NetworkInterface : false;
        if (ifname){
            xlocalip = this.resolver.ifs[ifname] ? this.resolver.ifs[ifname] : false;
            xlocalport = this.resolver.sip[group] ? this.resolver.sip[group][proto+"Port"] : false;
            if (this.debug) console.log('!!!!!!!!!!!!!!!!! IN IFNAME MATCH', group, ifname, alias, proto, xlocalip, xlocalport);
        } else {
            if (this.debug) console.log('!!!!!!!!!!!!!!!!! IN IFNAME FAILURE', group, ifname, alias, proto);
        }
        return {alias, group, proto, ifname, xlocalip, xlocalport}
    } else {
        return false
    }
}

const watchIni = function(filePath, ini){
    logger.info('Watching INI for changes...',filePath);
    fs.watch(filePath, (event, filename) => {
        if (filename && event ==='change'){
            logger.info('INI file Changed! Reloading...', filename);
            ini = parseIni(filePath);
        }
    });
}

const parseIni = function(filePath){
    var config = ini.parse(fs.readFileSync(filePath, 'utf-8'))

    var interface = config.InterfaceTable;
    var interface_index = interface['FORMAT Index'].split(', '); delete interface['FORMAT Index'];
    var interface_obj = {};
    var count = 0;
    Object.entries(interface).forEach(entry => {
        const [key, value] = entry;
        var values = value.split(', ');
        interface_obj[count] = {};
        values.forEach(function(val, link){
            interface_obj[count][interface_index[link]] = val.replace(/^["'](.+(?=["']$))["']$/, '$1');
        });
        count++;
    });

    var ifs = {};
    Object.entries(interface_obj).forEach(entry => {
        ifs[entry[1].InterfaceName] = entry[1].IPAddress;
    });

    var sipinterface = config.SIPInterface;
    var sipinterface_index = sipinterface['FORMAT Index'].split(', '); delete sipinterface['FORMAT Index'];
    var sipinterface_obj = {};
    var count = 0;
    Object.entries(sipinterface).forEach(entry => {
        const [key, value] = entry;
        var values = value.split(', ');
        var realm = values[0].replace(/^["'](.+(?=["']$))["']$/, '$1'); delete values[0];
        sipinterface_obj[realm] = {};
        values.forEach(function(val, link){
            sipinterface_obj[realm][sipinterface_index[link]] = val.replace(/^["'](.+(?=["']$))["']$/, '$1');
        });
        count++;
    });


    if (this.debug) logger.info('INI Interfaces', interface_obj);
    if (this.debug) logger.info('INI SIP Interfaces', sipinterface_obj);

    return { interfaces: interface_obj, sip: sipinterface_obj, ifs: ifs }
}
