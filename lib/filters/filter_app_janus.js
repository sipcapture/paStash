var base_filter = require('../lib/base_filter'),
  dirty = require('dirty'),
  util = require('util');

function FilterAppJanus() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppJanus',
    start_hook: this.start,
  });
}

util.inherits(FilterAppJanus, base_filter.BaseFilter);

FilterAppJanus.prototype.start = function(callback) {
  this.db = dirty();
  callback();
};

FilterAppJanus.prototype.process = function(data) {
 // Process MEETECHO JANUS Events
 try {
  if (!data.type && data.message) { data.message = JSON.parse(data.message)[0] };
  if (data.message.type == 1) {
    // session create/destroy
        // store session_id for transport lookups
        if(data.message.session_id && data.message.event.transport && data.message.event.transport.id ) {
          db.set(data.message.session_id, { transport_id: data.message.event.transport.id }, function() {
          });
        }
        if (data.message.event.name == "created" && data.message.session_id) {
          db.set("sess_"+data.message.event.transport.id, { session_id: data.message.session_id.toString() }, function() {
          });
        } else if (data.message.event.name == "destroyed") {
          // cleanup db
          try {
                if (db.get(db.get(data.message.session_id).transport_id)) {
                        setTimeout(function() {
                          try { db.rm(db.get(db.get(data.message.session_id).transport_id)); } catch(err) { if (debug) console.log(err); }
                        }, 2000);
                  }
                  setTimeout(function() {
                     try {
                        db.rm(data.message.session_id);
                        db.rm(data.message.transport_id);
                        db.rm("sess_"+data.message.transport_id);
                     } catch(err) { if (debug) console.log(err); }
                  }, 2000);
         } catch(err) { if (debug) console.log(err); }
        }
  } else if (data.message.type == 128) {
    // transports, no session_id native
        // store IP for Session for transport lookups
        if(data.message.event.id && data.message.event.data['ip'] && data.message.event.data['port']) {
          db.set(data.message.event.id, {ip: data.message.event.data['ip'].replace('::ffff:',''),port: data.message.event.data['port'] }, function() {
          });
        }
        if (!data.message.session_id && data.message.event.id) {
                        var getsession = db.get("sess_"+data.message.event.id);
                        if (getsession && getsession.session_id != undefined) {
                                data.message.session_id = getsession.session_id;
                        };
        }

  } else if (data.message.type == 32) {
        if (!data.message.session_id) return;
        // lookup of media transport IP - ignoring handle_id or grabbing them all
        if (db) {
          if (data.message.session_id && db.get(data.message.session_id)) {
            data.message.ip = { 
                ip: db.get(db.get(data.message.session_id).transport_id).ip, 
                port: db.get(db.get(data.message.session_id).transport_id).port 
            };
          } 
        }
  }

  if(data.message.session_id) data.message.session_id = data.message.session_id.toString();
	if(data.message.handle_id) data.message.handle_id = data.message.handle_id.toString();
	if(data.message.sender) data.message.sender = data.message.sender.toString();
  if(data.message.type) data.message.type = data.message.type.toString();
  if(data.message.event && data.message.even.transport) { if (typeof data.message.event.transport === "string") { data.message.event.transport = { transport: data.message.event.transport } } }
	if(data.message.plugindata && data.message.plugindata.data && data.message.plugindata.data.result) { 
		if (typeof data.message.plugindata.data.result === "string") { data.message.plugindata.data.result = { result: data.message.plugindata.data.result } }
	}

  return data;
	 
 } catch(e) { return data; } 
};

exports.create = function() {
  return new FilterAppJanus();
};
