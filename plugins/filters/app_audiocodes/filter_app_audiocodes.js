/*
   Custom, Unoptimized Audiocodes Log to SIP/HEP3 Parser w/ reassembly of rows
   (C) 2020 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
    util = require('util'),
    logger = require('@pastash/pastash').logger

var fs = require('fs'), 
    ini = require('ini')

var moment = require('moment')
var LRU = require("lru-cache"), 
    sid_cache = new LRU(1000),
    expire = 10000 * 60 * 60

function FilterAppAudiocodes() {
      base_filter.BaseFilter.call(this);
      this.mergeConfig({
     name: 'AppAudiocodes',
        optional_params: ['correlation_hdr','bypass', 'debug', 'file_debug', 'logs', 'localip', 'localport', 'correlation_contact', 'qos', 'autolocal', 'version', 'ini', 'iniwatch'],
        default_values: {
            'correlation_contact': false,
            'correlation_hdr': false,
            'debug': false,
            'file_debug': false,
            'bypass': false,
            'logs': false,
            'qos': true,
            'autolocal': false,
            'localip': '127.0.0.1',
            'localport': 5060,
            'version': '7.20A.260.012',
            'ini': false,
            'iniwatch': false
     },
     start_hook: this.start,
     });
}

util.inherits(FilterAppAudiocodes, base_filter.BaseFilter);

FilterAppAudiocodes.prototype.start = function(callback) {
    logger.info('Initialized App Audiocodes SysLog to SIP/HEP parser');
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

    this.postProcess = function(session, message, type) {
        if ( !message||!session ) return
        message = message.replace(/#012/g, '\r\n').trim() + '\r\n\r\n'
        var rcinfo = {
            type: 'HEP',
            version: 3,
            payload_type: type ? 'LOG' :'SIP',
            ip_family: 2,
            protocol: 17,
            proto_type: type || 1,
            correlation_id: session.callId || '',
            srcIp: session.srcIp || this.localip,
            srcPort: session.srcPort || 0,
            dstIp: session.dstIp || this.localip,
            dstPort: session.dstPort || 0,
            time_sec: session.ts || parseInt(new Date().getTime() / 1000),
            time_usec: session.usec || new Date().getMilliseconds()
        }
        // EXTRACT CORRELATION HEADER, IF ANY
        if (this.correlation_hdr && rcinfo.proto_type == 1 && message.startsWith('INVITE')) {
          var xcid = message.match(this.correlation_hdr+":\s?(.*)\r\n\r\n")
          if (xcid && xcid[1]) rcinfo.correlation_id = xcid[1].trim()
         if (this.debug) logger.info('auto correlation pick', rcinfo.correlation_id)
        }

        if (this.correlation_contact && rcinfo.proto_type == 1 && message.startsWith('INVITE')) {
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

        if (message && rcinfo) {
            var data = { payload: message, rcinfo: rcinfo }
            if (this.debug) console.log('FINAL DATA')
            if (this.debug) console.log(data.payload)
            this.emit('output', data)
            return
        }
    }
    callback();
};

/**
 * Session Manager
 * Object to manage SIP Sessions in cache
 */
let sessionManager = {
    evaluateMessage: function (line) {
        /* Extract SID and SEQ from SIP Message */
        var seqObj = /.*\[S=(?<seq>[0-9]+)\].*/.exec(line)
	    var sidObj = /\[SID=(?<sid>.*?)\]/.exec(line)

        if (!seqObj || !sidObj) {
            if (this.bypass) return data
            logger.error(`Invalid SIP Message, missing SID or SEQ in Line: ${line}`)
            return
        }
        /* Unwrap SID and SEQ from Regexp */
        let seq = seqObj[1]
        let sid = sidObj[1]
        /* Remove SEQ and SID from line */
        line = line.replace(/\[S=[0-9]+\] \[SID=.*\]  /, '')

        

        if ((line.indexOf('Incoming SIP') !== -1 || line.indexOf('Outgoing SIP') !== -1) && line.trim().endsWith('#012#012')) {
            if (this.debug) console.log('FULL SIP MESSAGE', line)
            return sessionManager.createSession(sid, seq, line)
        }

        let session = {}
        /* Check if we are waiting for another part of this session */
        if (this.findSession(sid)) {
            if (this.debug) logger.info('Found existing session', sid)
            session = this.addFragment(sid, seq, line)
        } else {
            if (this.debug) logger.info('Created new entry', sid)
            session = this.createSession(sid, seq, line)
        }
        
        return session
    },
    findSession: function (sid) {
        if (this.debug) console.log('Finding session with sid: ', sid)
        if (sid_cache.has(sid)) {
            let session = sid_cache.get(sid)
            return session
        } else {
            return false
        }
    },
    createSession: function(sid, seq, message) {
        if (this.debug) console.log('Creating a session for a fragment', sid, seq)
        let messages = message.split(/(?=\(N  )/g)
        let session = {
            sid: sid,
            seq: seq,
            currentMessage: messages,
            buffer: [{message: message, seq: seq}],
        }
        sid_cache.set(sid, session)
        return session
    },
    addFragment: function(sid, seq, message) {
        let session = this.findSession(sid)
        if (this.debug) console.log('Adding fragment to session', sid, seq)
        let messages = message.split(/(?=\(N  )/g)
        for (let i = 0; i < messages.length; i++) {
            session.buffer.push({message: messages[i], seq: seq + (i / 10)})
            session.buffer = session.buffer.sort((a, b) => a.seq - b.seq)
        }
        session.currentMessage = this.rawSip(session)
        sid_cache.set(sid, session)
        return session
    },
    rawSip: function(session) {
        let rawSIP = []
        /* Determine complete messages based on content, not messages */
        for (let i = 0; i < session.buffer.length; i++) {
            let type = this.preScreen(session.buffer[i].message)
            if (this.debug) console.log('Prescreening Type for completion check', type)
            if (type === 'incoming' || type === 'outgoing') {
                rawSIP.push(session.buffer[i].message)
            } else if (type === 'incomplete') {
                if (i + 1 >= session.buffer.length) {
                    logger.info('Incomplete SIP Message no more to add at this time, will cache', session.buffer[i].message) 
                    continue
                }
                let type = this.preScreen(session.buffer[i].message + session.buffer[i + 1].message)
                if (this.debug) console.log('Fragmented, looking ahead in buffer')
                if (type === 'incoming' || type === 'outgoing') {
                    rawSIP.push(session.buffer[i].message + session.buffer[i + 1].message)
                    i++
                    continue
                } else {
                    if (this.debug) console.log('Merging Fragments and caching')
                    session.buffer[i].message += session.buffer[i + 1].message
                    session.buffer.splice(i + 1, 1)
                    continue
                }
            } else {
                /* Unknown type should be sent as log */
                rawSIP.push(session.buffer[i].message)
            }
        }
        return rawSIP
    },
    removeFragment: function(session, sipPayload) {
        let newBuffer = session.buffer.filter((a) => !sipPayload.includes(a.message))
        if (this.debug) console.log('Removing Fragment from Session', session.sid)
        if (newBuffer.length === 0) {
            if (this.debug) console.log('Removing Session from Cache', session.sid)
            sid_cache.del(session.sid)
            return
        }
        session.buffer = newBuffer
        sid_cache.set(session.sid, session)
        return
    },
    preScreen: function(message) {
        if (message.indexOf('Incoming SIP Message') !== -1) {
            if (message.endsWith('#012#012')) {
                return 'incoming'
            } else {
                let test = agnostic.exec(message)
                if (!test?.groups?.sip) {
                    return 'incomplete'
                } else {
                    if (test.groups.sip.endsWith('#012#012')) {
                        return 'incoming'
                    } else {
                        if (test.groups.sip.endsWith('#012')) {
                            test.groups.sip += '#012'
                            return 'incoming'
                        } else {
                            return 'incomplete'
                        }
                    }
                }
            }
        } else if (message.indexOf('Outgoing SIP Message') !== -1) {
            if (message.endsWith('#012#012')) {
                return 'outgoing'
            } else {
                let test = agnostic.exec(message)
                if (!test?.groups?.sip) {
                    return 'incomplete'
                } else {
                    if (test.groups.sip.endsWith('#012#012')) {
                        return 'outgoing'
                    } else {
                        if (test.groups.sip.endsWith('#012')) {
                            test.groups.sip += '#012'
                            return 'outgoing'
                        } else {
                            return 'incomplete'
                        }
                    }
                }
            }
        } else {
            return 'unknown'
        }
    }
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
	/* Message to String*/
	var line = data.message.toString()

	/* Debug for when we send a text file for debug */
	if (this.file_debug) {
		console.log('RECEIVED LINE')
		console.log(JSON.stringify(line))
		line = line.replace(/\\n/g, '\n')
		line = line.replace(/\\r/g, '\r')
		line = line.replace(/"/g, '')
		line = line.replace(/\\\"/g, '\"')
		console.log('Fixed Line from File Input to syslog input')
		console.log(line)
	}

	if (this.debug) console.info('DEBUG', line)

    /* Remove brinary prefix, Remove trailing timestamp, helps with detection of final fragment */
    try {
        line = line.split('<157>')[1]
        line = line.split(' [Time:')[0]
    } catch (err) {
        logger.error('Unknown Event or malformed line')
        logger.error(data.message.toString())
        if (this.debug) console.log('ERROR', err)
        return
    }
    

	/* Prepare line for processing */
	line = line.replace(/\r\n/g, '#012')

    let messages = this.splitMessages(line)

	/* Create Session or append to Session */
    messages.forEach((msg) => {
	    let session = sessionManager.evaluateMessage(msg)
    
        if (!session) return

        session.currentMessage.forEach((msg) => {
            this.sipRouter(session, msg)
        })
    })
}

exports.create = function() {
    return new FilterAppAudiocodes()
}

FilterAppAudiocodes.prototype.splitMessages = function(line) {
    let messages = []
    let split = line.split(/(?=\(N  )/g)
    
    /** 
     * @param {string} first Sequence number and Session ID 
     * */
    let first = split.shift()
    if (split.length > 1) {
        split.forEach((msg) => {
            let newmsg = first + msg
            messages.push(newmsg)
        })
    } else {
        messages.push(line)
    }
    return messages
}

FilterAppAudiocodes.prototype.sipRouter = async function(session, message) {
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
                this.handleSIP(session, rawSIP, 'incoming', resolvedObj)
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
                this.handleSIP(session, rawSIP, 'outgoing', resolvedObj)
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

FilterAppAudiocodes.prototype.handleSIP = async function(session, rawSIP, direction, resolved) {
    /* Extract and set src/dst IP and Ports */
    if (resolved.xlocalip && resolved.xlocalport){
        if (direction === 'incoming') {
            session.dstIp = resolved.xlocalip
            session.dstPort = parseInt(resolved.xlocalport)
        } else {
            session.srcIp = resolved.xlocalip
            session.srcPort = parseInt(resolved.xlocalport)
        }
    } else if (rawSIP.groups.alias) {
        // convert alias to IP:port 
        if (direction === 'incoming') {
            session.dstIp = aliases[0] || this.localip
            session.dstPort = aliases[1] || this.localport
        } else {
            session.srcIp = aliases[0] || this.localip
            session.srcPort = aliases[1] || this.localport
        }
    }

    if (direction === 'incoming') {
        session.srcIp = rawSIP.groups.ip.split(':')[0]
        session.srcPort = parseInt(rawSIP.groups.ip.split(':')[1])
    } else {
        session.dstIp = rawSIP.groups.ip.split(':')[0]
        session.dstPort = parseInt(rawSIP.groups.ip.split(':')[1])
    }

    let message = rawSIP.groups.sip
    if (message.length < 1) {
        logger.error('BAD LINE', rawSIP)
        return
    }
    sessionManager.removeFragment(session, rawSIP.input)
    var callid = message.match(/call-id:\s?(.*?)\s?#012/i) || []
    session.callId = callid[1] || session.sid || ''
    return this.postProcess(session, message)
}

FilterAppAudiocodes.prototype.invokeResolver = function(session, ip) {
    if (this.debug) console.log('Invoking Resolver')
    let aliasregex = /SIPInterface #([^\s]+) \((.*)\) (.*) TO/g;
    let interface = aliasregex.exec(session.currentMessage) || false;
    if (this.resolver && interface){
        let alias = interface[1]; //0
        let group = interface[2]; //some-group
        let proto = interface[3]; //UDP,TCP,TLS

        let ifname = this.resolver.sip[group] ? this.resolver.sip[group].NetworkInterface : false;
        if (ifname){
            let xlocalip = this.resolver.ifs[ifname] ? this.resolver.ifs[ifname] : false;
            let xlocalport = this.resolver.sip[group] ? this.resolver.sip[group][proto+"Port"] : false;
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
