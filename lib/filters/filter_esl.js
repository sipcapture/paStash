/*

Filter ESL Correlation Utility
(c) 2017 Lorenzo Mangani, QXIP BV

*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

// Prepare
var dirty = require('dirty');
var db = dirty('uuid.db');

var report_call_events = false;
var report_rtcp_events = false;
var report_qos_events = false;
var log = true;

// Functions
var getRTCPMessage = function(e, xcid) {
            var message = {
              rcinfo: {
                type: 'HEP',
                version: 3,
                payload_type: 'JSON',
                ip_family: 2,
                protocol: 17,
                proto_type: 5,
                srcIp: e.getHeader('variable_local_media_ip') ? e.getHeader('variable_local_media_ip') : '127.0.0.1',
                dstIp: e.getHeader('variable_remote_audio_ip_reported') ? e.getHeader('variable_remote_audio_ip_reported') : '127.0.0.1',
                srcPort: parseInt(e.getHeader('variable_local_media_port')) ? parseInt(e.getHeader('variable_local_media_port')) : 0,
                dstPort: parseInt(e.getHeader('variable_remote_media_port')) ? parseInt(e.getHeader('variable_remote_media_port')) : 0,
                correlation_id: xcid ? xcid : db.get(e.getHeader('Unique-ID')).cid
              },
              payload:  JSON.stringify({ 
                "type":200,
                "ssrc": e.getHeader('SSRC'),
                "report_count": parseInt(e.getHeader('Event-Sequence')),
                "report_blocks":[{
                  "source_ssrc": e.getHeader('Source0-SSRC'),
                  "fraction_lost": parseInt(e.getHeader('Source0-Fraction')),
                  "packets_lost": parseInt(e.getHeader('Source0-Lost')),
                  "highest_seq_no": parseInt(e.getHeader('Source0-Highest-Sequence-Number-Received')),
                  "lsr": parseInt(e.getHeader('Source0-LSR')),
                  "ia_jitter": parseFloat(e.getHeader('Source0-Jitter')),
                  "dlsr": parseInt(e.getHeader('Source0-DLSR'))
                }],
                "sender_information":{
                  "packets": parseInt(e.getHeader('Sender-Packet-Count')),
                  "ntp_timestamp_sec": parseInt(e.getHeader('NTP-Most-Significant-Word')),
                  "ntp_timestamp_usec": parseInt(e.getHeader('NTP-Least-Significant-Word')),
                  "rtp_timestamp": parseInt(e.getHeader('RTP-Timestamp')),
                  "octets": parseInt(e.getHeader('Octect-Packet-Count'))
                }
              })
            };

  return message;
};

var getQoSMessage = function(e, xcid) {
            var message = {
              rcinfo: {
                type: 'HEP',
                version: 3,
                payload_type: 'JSON',
                ip_family: 2,
                protocol: 17,
                proto_type: 32,
                mos: -1,
                srcIp: e.getHeader('variable_local_media_ip') ?  e.getHeader('variable_local_media_ip') : '127.0.0.1',
                dstIp: e.getHeader('variable_remote_audio_ip_reported') ? e.getHeader('variable_remote_audio_ip_reported') : '127.0.0.1',
                srcPort: parseInt(e.getHeader('variable_local_media_port')) ? parseInt(e.getHeader('variable_local_media_port')) : 0,
                dstPort: parseInt(e.getHeader('variable_remote_media_port')) ? parseInt(e.getHeader('variable_remote_media_port')) : 0,
                correlation_id: xcid ? xcid : e.getHeader('variable_sip_call_id')
              },
              payload:  JSON.stringify({ 
                "CORRELATION_ID": xcid ? xcid : e.getHeader('variable_sip_call_id'),
                "RTP_SIP_CALL_ID": xcid ? xcid : e.getHeader('variable_sip_call_id'),
                "JITTER": (parseInt(e.getHeader('variable_rtp_audio_in_jitter_max_variance')) + parseInt(e.getHeader('variable_rtp_audio_in_jitter_max_variance')))/2,
                "REPORT_TS": parseInt(e.getHeader('Event-Date-Timestamp')),
                "TL_BYTE": parseInt(e.getHeader('variable_rtp_audio_in_media_bytes'))+parseInt(e.getHeader('variable_rtp_audio_out_media_bytes')),
                "TOTAL_PK": parseInt(e.getHeader('variable_rtp_audio_in_packet_count'))+parseInt(e.getHeader('variable_rtp_audio_out_packet_count')),
                "PACKET_LOSS": parseInt(e.getHeader('variable_rtp_audio_in_skip_packet_count'))+parseInt(e.getHeader('variable_rtp_audio_out_skip_packet_count')),
                "MAX_JITTER": parseFloat(e.getHeader('variable_rtp_audio_in_jitter_max_variance')),
                "MIN_JITTER": parseFloat(e.getHeader('variable_rtp_audio_in_jitter_min_variance')),
                "DELTA": parseFloat(e.getHeader('variable_rtp_audio_in_mean_interval')),
                "MOS": parseFloat(e.getHeader('variable_rtp_audio_in_mos')),
                "SRC_IP": e.getHeader('variable_advertised_media_ip'), 
                "SRC_PORT": parseInt(e.getHeader('variable_local_media_port')), 
                "DST_IP": e.getHeader('variable_remote_media_ip'),
                "DST_PORT": parseInt(e.getHeader('variable_remote_media_port')),
                "CODEC_PT": parseInt(e.getHeader('variable_rtp_audio_recv_pt')), 
                "PTIME": parseInt(e.getHeader('variable_rtp_use_codec_ptime')),
                "CLOCK": parseInt(e.getHeader('variable_rtp_use_codec_rate')),
                "CODEC_NAME": e.getHeader('variable_rtp_use_codec_name'),
                "TYPE": e.getHeader('Event-Name')
              })
            };
  return message;
};

var getCallMessage = function(e, xcid, payload) {
  var message = {
    rcinfo: {
      type: 'HEP',
      version: 3,
      payload_type: 'JSON',
      ip_family: 2,
      protocol: 17,
      proto_type: 100,
      srcIp: e.getHeader('FreeSWITCH-IPv4'),
      dstIp: e.getHeader('FreeSWITCH-IPv4'),
      srcPort: 0,
      dstPort: 0,
      correlation_id: xcid ? xcid : e.getHeader('variable_sip_call_id')
    },
    payload: payload
  };

  return message;
};


function FilterESL() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'ESL',
    start_hook: this.start,
  });
}

util.inherits(FilterESL, base_filter.BaseFilter);

FilterESL.prototype.process = function(e) {

  try {

      if (!e.getHeader('Event-Name') || !e.getHeader('Unique-ID') ) return;

      if (db) {
        if (db.get(e.getHeader('Other-Leg-Unique-ID'))) {
          logger.log('FOUND B-LEG!', db.get(e.getHeader('Other-Leg-Unique-ID')).cid);
          var xcid = db.get(e.getHeader('Other-Leg-Unique-ID')).cid;
        } else if (db.get(e.getHeader('Unique-ID'))) {
          logger.log('FOUND!', db.get(e.getHeader('Unique-ID')).cid);
          var xcid = db.get(e.getHeader('Unique-ID')).cid;
        } else { 
          logger.log('DEFAULT!', db.get(e.getHeader('variable_sip_call_id')));
          var xcid = e.getHeader('variable_sip_call_id'); 
        }
      } else { var xcid = e.getHeader('variable_sip_call_id'); }
      
      if (log) {
        var payload = e.getHeader('Event-Date-Local') + ': ';
        if(e.getHeader('Event-Name')) {
          if(e.getHeader('Event-Name') == 'CHANNEL_CREATE') {
            if(e.getHeader('Call-Direction') == 'inbound'){
              payload +=  'RINGING; ';
              payload +=  e.getHeader('Call-Direction') + '; ';
              payload +=  e.getHeader('Caller-Caller-ID-Number') + '; ';
              payload +=  e.getHeader('Caller-Destination-Number') + '; ';
              payload +=  e.getHeader('Unique-ID') + '; ';
            } else {
              payload +=  'RINGING; ';
              payload +=  e.getHeader('Call-Direction') + '; ';
              payload +=  e.getHeader('Caller-Callee-ID-Number') + '; ';
              payload +=  e.getHeader('Caller-Caller-ID-Number') + '; ';
              payload +=  e.getHeader('Unique-ID') + '; ';
            }

            db.set(e.getHeader('Unique-ID'), {cid: e.getHeader('variable_sip_call_id')}, function() {
              logger.log('Session init saved!');
            });
          } else if(e.getHeader('Event-Name') == 'CHANNEL_ANSWER') {
            if(e.getHeader('Call-Direction') == 'inbound'){
              payload += 'ANSWERED; ';
              payload +=  e.getHeader('Caller-Caller-ID-Number') + '; ';
              payload +=  e.getHeader('Unique-ID') + '; ';
            } else {
              payload += 'ANSWERED; ';
              payload +=  e.getHeader('Caller-Callee-ID-Number') + '; ';
              payload +=  e.getHeader('Unique-ID') + '; ';
            }

            db.set(e.getHeader('Unique-ID'), {cid: e.getHeader('variable_sip_call_id')}, function(e) {
              logger.log('Session answer saved!' );
            });
          } else if(e.getHeader('Event-Name') == 'CHANNEL_DESTROY') {
            if(e.getHeader('Call-Direction') == 'inbound'){
              payload += 'HANGUP; ';
              payload +=  e.getHeader('Caller-Caller-ID-Number') + '; ';
              payload +=  e.getHeader('Unique-ID') + '; ';
            } else {
              payload += 'HANGUP; ';
              payload +=  e.getHeader('Caller-Callee-ID-Number') + '; ';
              payload +=  e.getHeader('Unique-ID') + '; ';
            }
            
            db.rm(e.getHeader('Unique-ID'), function(e) {
              logger.log('Session UUID has been removed!');
            });
          } else if(e.getHeader('Event-Name') == 'CUSTOM') {
            if(e.getHeader('Event-Subclass') === 'sofia::register'){
              payload += 'REGISTER; ';
              payload +=  e.getHeader('from-user') + '; ';
              payload +=  e.getHeader('network-ip') + '; ';
            } else if(e.getHeader('Event-Subclass') === 'sofia::unregister'){
              payload += 'UNREGISTER; ';
              payload +=  e.getHeader('from-user') + '; ';
              payload +=  e.getHeader('network-ip') + '; ';
            }
          } else if(e.getHeader('Event-Name') == 'DTMF') {
            logger.log('DTMF EVENT',e);
            payload += e.getHeader('Event-Name') + ' DIGIT: '+e.getHeader('DTMF-Digit') + ' DURATION: '+e.getHeader('DTMF-Duration') + ' FROM:'+ e.getHeader('variable_sip_from_user') + ' TO: ' + e.getHeader('variable_sip_req_user');
          } else { 
            payload += e.getHeader('Event-Name') + '; ' + e.getHeader('Channel-Name') + ' (' + e.getHeader('Event-Calling-Function') + ')';
          }

          if (report_call_events) {
            return getCallMessage(e, xcid, payload);
          }
        }
      }

      if (report_rtcp_events) {
        if(e.getHeader('Event-Name') == 'RECV_RTCP_MESSAGE') {
          if (e.getHeader('Source0-SSRC')) {
            logger.log('Processing RTCP Report...',e);
            return getRTCPMessage(e, xcid);
          }
        }
      }

      if (report_qos_events) {
        if(e.getHeader('Event-Name') == 'CHANNEL_DESTROY') {
          if(e.getHeader('variable_rtp_use_codec_rate') && e.getHeader('variable_sip_call_id')) {
            return getQoSMessage(e, xcid);
          }
        }
      }


  }
  catch (e) {}

  // return data;

};

exports.create = function() {
  return new FilterESL();
};
