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
      if (this.ini){
        logger.info('Reading INI file to resolver...', this.ini);
        try {
            this.resolver = parseIni(this.ini);
            logger.info('INI Loaded '+this.resolver.interfaces.lenght +' Interfaces');
            logger.info('INI Loaded '+this.resolver.sip.lenght +' SIP Profiles');
            if (this.debug) console.log(this.resolver);
            if (this.iniwatch) watchIni(this.ini, this.resolver);
        } catch(err) { logger.error(err) }
     }

      this.postProcess = function(ipcache,last,type){
         if(!last||!ipcache) return;
        last = last.replace(/#012/g, '\r\n').trim() + "\r\n\r\n";
        var rcinfo = {
            type: 'HEP',
            version: 3,
            payload_type: type ? 'LOG' :'SIP',
            ip_family: 2,
            protocol: 17,
            proto_type: type || 1,
            correlation_id: ipcache.callId || '',
            srcIp: ipcache.srcIp || this.localip,
            srcPort: ipcache.srcPort || 0,
            dstIp: ipcache.dstIp || this.localip,
            dstPort: ipcache.dstPort || 0,
            time_sec: ipcache.ts || parseInt(new Date().getTime() / 1000),
            time_usec: ipcache.usec || new Date().getMilliseconds()
        };

        // EXTRACT CORRELATION HEADER, IF ANY
        if (this.correlation_hdr && rcinfo.proto_type == 1 && last.startsWith('INVITE')) {
           var xcid = last.match(this.correlation_hdr+":\s?(.*)\r\n\r\n");
            if (xcid && xcid[1]) rcinfo.correlation_id = xcid[1].trim();
            if (this.debug) logger.info('auto correlation pick', rcinfo.correlation_id);
        }

         if (this.correlation_contact && rcinfo.proto_type == 1 && last.startsWith('INVITE')) {
            var extract = /x-c=(.*?)\//.exec(last);
            if (extract[1]) {
                rcinfo.correlation_id = extract[1];
                if (this.debug) logger.info('auto correlation pick', rcinfo.correlation_id);
            }
         }

         if (last.indexOf('2.0/TCP') !== -1 || last.indexOf('2.0/TLS') !== -1 ){
            rcinfo.protocol = 6;
            if (this.autolocal) rcinfo.dstPort = 5061;
        }

        if (last && rcinfo) {
           var data = { payload: last, rcinfo: rcinfo };
            console.log('FINAL DATA')
            console.log(data.payload)
            return data;
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
        var seqObj = /.*\[S=(?<seq>[0-9]+)\].*/.exec(line)
	    var sidObj = /\[SID=(?<sid>.*?)\]/.exec(line)
        if (!seqObj || !sidObj) {
            if (this.bypass) return data
            throw new Error(`Invalid SIP Message, missing SID or SEQ in Line: ${line}`)
        }
        let seq = seqObj[1]
        let sid = sidObj[1]
        let session = {}
        if (this.findSession(sid)) {
            if (this.debug) logger.info('FOUND SESSION', sid)
            session = this.addFragment(sid, seq, line)
        } else {
            if (this.debug) logger.info('NEW SESSION', sid)
            session = this.createSession(sid, seq, line)
        }
        return session
    },
    findSession: function (sid) {
        if(sid_cache.has(sid)) {
            return sid_cache.get(sid)
        } else {
            return false
        }
    },
    createSession:function(sid, seq, message) {
        let session = {
            sid: sid,
            seq: seq,
            currentMessage: message,
            payloads: [{message: message, seq: seq}]
        }
        sid_cache.set(sid, session)
        return session
    },
    addFragment:function(sid, seq, message) {
        let session = this.findSession(sid)
        /* TODO: add message to payload in sequence */
        if(session) {
            session.seq = seq
            session.currentMessage = message
            session.payloads.push({message: message, seq: seq})
            sid_cache.set(sid, session)
            // this.checkComplete(session)
            return session
        } else {
            return false
        }
    },
    checkComplete:function(session) {
        let check = session.payload.match(/\r\n\r\n/g)
        console.log('CHECK COMPLETE', check)
        if (check.length < 1) {
            console.log('NOT complete')
            return false
        }
        return true
    }
}

var last = '';
var ipcache = {};
var aliases = {};

var hold;
var cache;
var seqN;

/**
 * Receives a buffer from an input or filter
 * @param {buffer} data 
 * @returns {object} processed data
 */
FilterAppAudiocodes.prototype.process = function(data) {
	/* Message to String*/
	var line = data.message.toString();
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

	/* Adjust Regexp for 7.40A.500 format*/
    /*
	if (this.version === '7.40A.500') {
		var message = /.*\[S=([0-9]+)\].*?\[SID=.*?\]\s?(.*)\[Time:.*\]/g
	} else {
		var message = /^.*?\[S=([0-9]+)\].*?\[SID=.*?\]\s?(.*)\[Time:.*\]$/
	}

	
	var test = message.exec(line.replace(/\r\n/g, '#012'))

	if(hold && line && test) {
		if (this.debug) logger.error('Next packet number', test[1])
		if (parseInt(test[1]) == seq + 1) {
			line = cache + ( test ? test[2] : '')
			hold = false
			cache = ''
			if (this.debug) console.info('reassembled line', line)
		}
	}*/

	/* Prepare line for processing */
	line = line.replace(/\r\n/g, '#012')

	/* Create Session or append to Session */
	let session = sessionManager.evaluateMessage(line)

	if (this.debug) logger.error('SESSION SID',session.sid)

    this.sipRouter(session)
}

exports.create = function() {
    return new FilterAppAudiocodes()
}

/* Previous Router 

 if (line.indexOf('Incoming SIP Message') !== -1) {
        try {
			// Set regex based on version 
            // var regex = /(.*)---- Incoming SIP Message from (.*) to SIPInterface #[0-99] \((.*)\) (.*) TO.*--- #012(.*)#012 #012 #012(.*) \[Time:(.*)-(.*)@(.*)\]/g;
            var regex;
            if (this.version === '7.40A.500') {
                regex = /(.*)---- Incoming SIP Message from (.*) to SIPInterface #[0-99] \((.*)\) (.*) TO\(#[0-99]\) ----  (.*)/g; //7.40A.500.357
            } else if (this.version == '7.20A.256.511') {
                regex = /(.*)---- Incoming SIP Message from (.*) to SIPInterface #[0-99] \((.*)\) (.*) TO.*---  (.*)(.*)/g; //7.20A.256.511
            } else {
                regex = /(.*)---- Incoming SIP Message from (.*) to SIPInterface #[0-99] \((.*)\) (.*) TO.*---\s?#012(.*)#012\s?#012(.*)/g; //7.20A.260.012
            }

            if (this.resolver){
                var aliasregex = /SIPInterface #([^\s]+) \((.*)\) (.*) TO/g;
                var interface = aliasregex.exec(line) || false;
                if (this.resolver && interface){
                    var alias = interface[1]; //0
                    var group = interface[2]; //some-group
                    var proto = interface[3]; //UDP,TCP,TLS

                    var ifname = this.resolver.sip[group] ? this.resolver.sip[group].NetworkInterface : false;
                    if (ifname){
                        var xlocalip = this.resolver.ifs[ifname] ? this.resolver.ifs[ifname] : false;
                        var xlocalport = this.resolver.sip[group] ? this.resolver.sip[group][proto+"Port"] : false;
                        if (this.debug) console.log('!!!!!!!!!!!!!!!!! IN IFNAME MATCH', group, ifname, alias, proto, xlocalip, xlocalport);
                    } else {
                        if (this.debug) console.log('!!!!!!!!!!!!!!!!! IN IFNAME FAILURE', group, ifname, alias, proto);
                    }
                }
            }
			// Apply Regexp to line 
            var ip = regex.exec(line);
            console.log('PROCESSED')
            console.log(ip)
            if (!ip) {
				console.log('BAD LINE', line)
                cache = line.replace(/\[Time.*\]$/,'');

                hold = true;
                var regpackid = /.*\[S=([0-9]+)\].\*\/.exec(line);
                seq = parseInt(regpackid[1]);
                if (this.debug) logger.error('Cached packet number', seq, line);
                logger.error('failed parsing Incoming SIP. Cache on!');
                if (this.bypass) return data;
            } else {
                if (xlocalip && xlocalport){
                    ipcache.dstIp = xlocalip;
                    ipcache.dstPort = parseInt(xlocalport);
                } else if (ip[3]) {
                    // convert alias to IP:port 
                    ipcache.dstIp = aliases[0] || this.localip;
                    ipcache.dstPort = aliases[1] || this.localport;
                }
                ipcache.srcIp = ip[2].split(':')[0];
                ipcache.srcPort = ip[2].split(':')[1];
                last = ip[5];
                last += '#012 #012';
                var callid = last.match(/call-id:\s?(.*?)\s?#012/i) || [];
                ipcache.callId = callid[1] || sid[1] || '';
                // Cache SID to Call-ID correlation
                sid_cache.set(sid[1], ipcache.callId, expire);
                // Seek final fragment
                if(ip[6]?.includes(' SIP Message ') && this.version !== '7.40A.500'){
                    hold = true;
                    cache = line.replace(/\[Time.*\]$/,'');
                }
                return this.postProcess(ipcache,last);
            }
        } catch(e) { 
            logger.error(e, line); 
        }

    } else if (line.indexOf('Outgoing SIP Message') !== -1) {
       try {
            var regex;
            if (this.version === '7.40A.500') {
                regex = /(.*) ---- Outgoing SIP Message to (.*) from SIPInterface #[0-99] \((.*)\) (.*) TO\(#.*\) ----  (.*)/g; //7.40A.500.357
            } else if (this.version == '7.20A.256.511') {
                regex = /(.*)---- Outgoing SIP Message to (.*) from SIPInterface #[0-99] \((.*)\) (.*) TO.*---  (.*)(.*)/g; //7.20A.256.511
            } else {
                    regex = /(.*)---- Outgoing SIP Message to (.*) from SIPInterface #[0-99] \((.*)\) (.*) TO.*---\s?#012(.*)#012\s?#012 (.*)/g; //7.20A.260.012
            }

            if (this.resolver) {
                var aliasregex = /SIPInterface #([^\s]+) \((.*)\) (.*) TO/g;
                var interface = aliasregex.exec(line) || false;
                if (this.resolver && interface) {
                    var alias = interface[1]; //0
                    var group = interface[2]; //some-group
                    var proto = interface[3]; //UDP,TCP,TLS

                    var ifname = this.resolver.sip[group] ? this.resolver.sip[group].NetworkInterface : false;
                    if (ifname) {
                        var xlocalip = this.resolver.ifs[ifname] ? this.resolver.ifs[ifname] : false;
                        var xlocalport = this.resolver.sip[group] ? this.resolver.sip[group][proto+"Port"] : false;
                        if (this.debug) console.log('!!!!!!!!!!!!!!!!! OUT IFNAME MATCH', group, ifname, alias, proto, xlocalip, xlocalport);
                    } else {
                        if (this.debug) console.log('!!!!!!!!!!!!!!!!! OUT IFNAME FAILURE', group, ifname, alias, proto);
                    }
                }
            }

            var ip = regex.exec(line);
            if (!ip) {
                cache = line.replace(/\[Time.*\]$/,'');
                hold = true;
                var regpackid = /.*\[S=([0-9]+)\].\*\/.exec(line);
                seq = parseInt(regpackid[1]);
                if (this.debug) logger.error('Cached packet number', seq, line);
                logger.error('failed parsing Outgoing SIP. Cache on!');
                if (this.bypass) return data;
            } else {
                if (xlocalip && xlocalport){
                    ipcache.srcIp = xlocalip;
                    ipcache.srcPort = parseInt(xlocalport);
                } else if (ip[3]) {
                    // convert alias to IP:port 
                    ipcache.srcIp = aliases[0] || this.localip;
                    ipcache.srcPort = aliases[1] || this.localport;
                }
                ipcache.dstIp = ip[2].split(':')[0];
                ipcache.dstPort = ip[2].split(':')[1];
                last = ip[5];
                last += '#012 #012';
                var callid = last.match(/call-id:\s?(.*?)\s?#012/i) || [];
                ipcache.callId = callid[1] || sid[1] || '';
                // Cache SID to Call-ID correlation
                sid_cache.set(sid[1], ipcache.callId, expire);
                // Seek final fragment
                if(ip[6]?.includes(' SIP Message ') && this.version !== '7.40A.500'){
                    hold = true;
                    cache = line.replace(/\[Time.*\]$/,'');
                }
                return this.postProcess(ipcache,last);
            }
     } catch(e) { 
            logger.error(e, line); 
        }
    } else if (this.autolocal && line.indexOf('Local IP Address =') !== -1) {
        var local = line.match(/Local IP Address = (.*?):(.*?),/) || [];
        if(local[1]) this.localip   = local[1];
        if(local[2]) this.localport = local[2];
    } else if (line.indexOf('CALL_END ') !== -1 && this.logs) {
        // Parser TBD page 352 @ https://www.audiocodes.com/media/10312/ltrt-41548-mediant-software-sbc-users-manual-ver-66.pdf
        var cdr = line.split(/(\s+\|)/).filter( function(e) { return e.trim().length > 1; } )
        ipcache.callId = cdr[3] || '';
        if (this.debug) logger.info('CALL_END', cdr, ipcache);
        if (this.logs) return this.postProcess(ipcache,JSON.stringify(cdr),100);
    } else if (line.indexOf('MEDIA_END ') !== -1 && this.qos) {
        // Parsed TBD page 353 @ https://www.audiocodes.com/media/10312/ltrt-41548-mediant-software-sbc-users-manual-ver-66.pdf
        var qos = line.split(/(\s+\|)/).filter( function(e) { return e.trim().length > 1; } )
        if (qos.length == 25){
            qos.splice(15, 1);
            qos.splice(5, 1);
        }
        logger.info('!!!!!!!!!!!!!! DEBUG MEDIA', qos, qos.length);
        if(qos && qos[2] && qos[21]){
            ipcache.callId = qos[2] || '';
            var response = [];
            // A-LEG
            ipcache.srcIp = qos[7];
            ipcache.srcPort = parseInt(qos[8]);
            ipcache.dstIp = qos[9];
            ipcache.dstPort = parseInt(qos[10]);
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
            response.push(this.postProcess(ipcache,JSON.stringify(local_report),35));
            // B-LEG
            ipcache.srcIp = qos[9];
            ipcache.srcPort = parseInt(qos[10]);
            ipcache.dstIp = qos[7];
            ipcache.dstPort = parseInt(qos[8]);
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
            response.push(this.postProcess(ipcache,JSON.stringify(remote_report),35));
            if (this.debug) logger.info('MEDIA_END', response);
            if (this.qos) return response;
        } else {
            logger.error('missing media parameters', qos);
        }
    } else if (sid && !hold && this.logs) {
        if (this.bypass) return data;
        // Prepare SIP LOG
        if (this.logs) {
            ipcache.callId = sid_cache.get(sid) || sid || '';
            ipcache.srcIp = this.localip || '127.0.0.1';
            ipcache.srcPort = 514
            ipcache.dstIp = this.localip || '127.0.0.1';
            ipcache.dstPort = 514
            return this.postProcess(ipcache,line,100);
        }
    } else {
        // Discard
        if (this.bypass) return data;
    }

*/

FilterAppAudiocodes.prototype.sipRouter = function(session) {
    console.log('Routing SIP Session')
    if (session.currentMessage.indexOf('Incoming SIP Message') !== -1) {
        console.log('Incoming SIP Message')
        try {
            /* Set regex based on version 
            var regex = /(.*)---- Incoming SIP Message from (.*) to SIPInterface #[0-99] \((.*)\) (.*) TO.*--- #012(.*)#012 #012 #012(.*) \[Time:(.*)-(.*)@(.*)\]/g; */
            let regex
            if (this.version === '7.40A.500') {
                regex = /(.*)---- Incoming SIP Message from (.*) to SIPInterface #[0-99] \((.*)\) (.*) TO\(#[0-99]\) ----  (.*)/g; //7.40A.500.357
            } else if (this.version == '7.20A.256.511') {
                regex = /(.*)---- Incoming SIP Message from (.*) to SIPInterface #[0-99] \((.*)\) (.*) TO.*---  (.*)(.*)/g; //7.20A.256.511
            } else {
                regex = /(.*)---- Incoming SIP Message from (.*) to SIPInterface #[0-99] \((.*)\) (.*) TO.*---\s?#012(.*)#012\s?#012(.*)/g; //7.20A.260.012
            }

            let resolvedObj = false
            if (this.resolver){
                resolvedObj = this.invokeResolver(session)
            }
            // Apply Regexp to line 
            let ip = regex.exec(session.currentMessage)
            if (!ip) {
                console.log('BAD LINE', session.currentMessage)
                cache = session.currentMessage.replace(/\[Time.*\]$/,'');

                hold = true;
                var regpackid = /.*\[S=([0-9]+)\].*/.exec(session.currentMessage);
                seqN = parseInt(regpackid[1]);
                if (this.debug) logger.error('Cached packet number', seqN, session.currentMessage);
                logger.error('failed parsing Incoming SIP. Cache on!');
                if (this.bypass) return data;
            } else  {
                this.handleSIP(session, ip, 'incoming')
            }
        } catch (err) {
            logger.error(err, line)
        }
    } else if (session.currentMessage.indexOf('Outgoing SIP Message') !== -1) {
        console.log('Outgoing SIP Message')
        try {
            let regex;
            if (this.version === '7.40A.500') {
                regex = /(.*) ---- Outgoing SIP Message to (.*) from SIPInterface #[0-99] \((.*)\) (.*) TO\(#.*\) ----  (.*)/g; //7.40A.500.357
            } else if (this.version == '7.20A.256.511') {
                regex = /(.*)---- Outgoing SIP Message to (.*) from SIPInterface #[0-99] \((.*)\) (.*) TO.*---  (.*)(.*)/g; //7.20A.256.511
            } else {
                    regex = /(.*)---- Outgoing SIP Message to (.*) from SIPInterface #[0-99] \((.*)\) (.*) TO.*---\s?#012(.*)#012\s?#012 (.*)/g; //7.20A.260.012
            }

            let resolvedObj = false
            if (this.resolver) {
                resolvedObj = this.invokeResolver(session)
            }

            // Apply Regexp to line 
            let ip = regex.exec(session.currentMessage)
            if (!ip) {
                console.log('BAD LINE', session.currentMessage)
                cache = session.currentMessage.replace(/\[Time.*\]$/,'');
                hold = true;
                var regpackid = /.*\[S=([0-9]+)\].*/.exec(session.currentMessage);
                seqN = parseInt(regpackid[1]);
                if (this.debug) logger.error('Cached packet number', seqN, session.currentMessage);
                logger.error('failed parsing Outgoing SIP. Cache on!');
                if (this.bypass) return data;
            } else  {
                this.handleSIP(session, ip, 'outgoing')
            }

        } catch (err) {
            logger.error(err, line)
        }
    } else if (this.autolocal && session.currentMessage.indexOf('Local IP Address =') !== -1) {
        console.log('Local IP Address')
    } else if (session.currentMessage.indexOf('CALL_END ') !== -1) {
        console.log('CALL_END')
    } else if (session.currentMessage.indexOf('MEDIA_END ') !== -1) {
        console.log('MEDIA_END')
    } else {
        if (this.bypass) return data
    }
}

FilterAppAudiocodes.prototype.handleSIP = function(session, ip, direction) {
    console.log(direction, session.sid, session.seq, ip[5])
}

FilterAppAudiocodes.prototype.invokeResolver = function(session, ip) {
    if(this.debug) console.log('Invoking Resolver')
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
            console.log('INI file Changed! Reloading...', filename);
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
