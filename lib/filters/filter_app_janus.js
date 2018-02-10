var base_filter = require('../lib/base_filter');
var util = require('util');
var cache_helper = require('../lib/cache_helper');

var Gun = require('gun');
var gun = Gun({ file: 'pastash.json'});
const db = gun.get('janus');

function FilterAppJanus() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppJanus',
    start_hook: this.start,
  });
}

util.inherits(FilterAppJanus, base_filter.BaseFilter);

FilterAppJanus.prototype.start = function(callback) {
  this.db = db;
  this.cache_miss = function(key, callback) {
    try {
      db.get(key).val(function(data, key){ calback(data); });
    }
    catch(e) {
      callback(e);
    }
  };


  callback();
};

FilterAppJanus.prototype.process = function(msg) {
 // Process MEETECHO JANUS Events
 var data = { message: msg, type: msg.type };
 try { if (!data.type && data.message) { data.message = JSON.parse(data.message)[0] }; } catch(e) { console.log('JSON!'); }

 var ship = function(data) {
	  if (!data.message) { console.log('NO MESSAGE!!! Skipping.. ',data); }
	  // SANITIZE!
	  try {
	  	if(data.message.session_id) data.message.session_id = data.message.session_id.toString();
		if(data.message.handle_id) data.message.handle_id = data.message.handle_id.toString();
		if(data.message.sender) data.message.sender = data.message.sender.toString();
	  	if(data.message.type) data.message.type = data.message.type.toString();
	  	if(data.message.event && data.message.event.transport) { 
			if (typeof data.message.event.transport === "string") { data.message.event.transport = { transport: data.message.event.transport } } }
		if(data.message.plugindata && data.message.plugindata.data && data.message.plugindata.data.result) { 
			if (typeof data.message.plugindata.data.result === "string") { data.message.plugindata.data.result = { result: data.message.plugindata.data.result } }
		}
	  } catch(e) { console.log('error sanitizing!',e); }	
	  this.emit('output',data.message);
 }.bind(this);

 // LOOP EVENT TYPE

 try {

  console.log('processing type: '+data.message.type);

  // SCROLL
  if (data.message.type == 1) {
    // session create/destroy
        // store session_id for transport lookups
        if(data.message.session_id && data.message.event.transport && data.message.event.transport.id ) {
          db.get(data.message.session_id).put({ transport_id: data.message.event.transport.id });
		db.get(data.message.session_id).val(function(data, key){ console.log("GUNDB update:", data); });

        }
        if (data.message.event.name == "created" && data.message.session_id && data.message.event.transport) {
          db.get("sess_"+data.message.event.transport.id).put({ session_id: data.message.session_id.toString() });
		db.get("sess_"+data.message.event.transport.id).val(function(data, key){ console.log("TRANSPORT CREATED:", data); });

        } else if (data.message.event.name == "destroyed") {
          // TODO: cleanup db
	  console.log('delete?');
        }
	ship(data);

  } else if (data.message.type == 2) {
    // session create/destroy
        // store session_id for transport lookups
        if(data.message.session_id && data.message.event.opaque_id ) {
          db.get(data.message.session_id).put({ opaque_id: data.message.event.opaque_id });
		db.get(data.message.session_id).val(function(data, key){ console.log("OPAQUE PAIRING:", data); });
        }
	ship(data);

  } else if (data.message.type == 64) {
	// skip type 64

  } else if (data.message.type == 128) {
    // transports, no session_id native
        // store IP for Session for transport lookups
        if(data.message.event.id !== 'undefined' && data.message.event.data['ip'] && data.message.event.data['port']) {
	  //        db.get(data.message.event.id).put({ip: data.message.event.data['ip'].replace('::ffff:',''),port: data.message.event.data['port']});
	  //		db.get(data.message.event.id).val(function(data, key){ console.log("IP/PORT PAIRING:", data); });
        }
        if (!data.message.session_id && data.message.event.id) {
                //        var getsession = db.get("sess_"+data.message.event.id).val(function(val){ return val; });
                //        if (getsession && getsession.session_id != undefined) {
                //                data.message.session_id = getsession.session_id;
                //        };
        }
	ship(data);

  } else if (data.message.type == 32) {
        if (!data.message.session_id) return data;
        // lookup of media transport IP - ignoring handle_id or grabbing them all
        if (db) {
	  console.log('SENDING 32!',data.message);
	  db.get(data.message.session_id).val(function(resp, key){ 
	                data.message.ip = { ip: resp.ip ? resp.ip : '0.0.0.0', port: resp.port ? resp.port : 0 };
			ship(data);
	    		});
        }
  } 
	 
 } catch(e) { console.log('BYPASS',e); ship(data); } 
};



exports.create = function() {
  return new FilterAppJanus();
};
