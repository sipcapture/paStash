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
  if (data.type == 1) {
    // session create/destroy
        // store session_id for transport lookups
        if(data.session_id && data.event.transport && data.event.transport.id ) {
          db.set(data.session_id, { transport_id: data.event.transport.id }, function() {
          });
        }
        if (data.event.name == "created" && data.session_id) {
          db.set("sess_"+data.event.transport.id, { session_id: data.session_id.toString() }, function() {
          });
        } else if (data.event.name == "destroyed") {
          // cleanup db
          try {
                if (db.get(db.get(data.session_id).transport_id)) {
                        setTimeout(function() {
                          try { db.rm(db.get(db.get(data.session_id).transport_id)); } catch(err) { if (debug) console.log(err); }
                        }, 2000);
                  }
                  setTimeout(function() {
                     try {
                        db.rm(data.session_id);
                        db.rm(data.transport_id);
                        db.rm("sess_"+data.transport_id);
                     } catch(err) { if (debug) console.log(err); }
                  }, 2000);
         } catch(err) { if (debug) console.log(err); }
        }
  } else if (data.type == 128) {
    // transports, no session_id native
        // store IP for Session for transport lookups
        if(data.event.id && data.event.data['ip'] && data.event.data['port']) {
          db.set(data.event.id, {ip: data.event.data['ip'].replace('::ffff:',''),port: data.event.data['port'] }, function() {
          });
        }
        if (!data.session_id && data.event.id) {
                        var getsession = db.get("sess_"+data.event.id);
                        if (getsession && getsession.session_id != undefined) {
                                data.session_id = getsession.session_id;
                        };
        }

  } else if (data.type == 32) {
        if (!data.session_id) return;
        // lookup of media transport IP - ignoring handle_id or grabbing them all
        if (db) {
          if (data.session_id && db.get(data.session_id)) {
            data.ip = { 
                ip: db.get(db.get(data.session_id).transport_id).ip, 
                port: db.get(db.get(data.session_id).transport_id).port 
            };
          } 
        }
  }


  if(data.session_id) data.session_id = data.session_id.toString();
	if(data.handle_id) data.handle_id = data.handle_id.toString();
	if(data.sender) data.sender = data.sender.toString();
  if(data.type) data.type = data.type.toString();
  if(data.event && data.even.transport) { if (typeof data.event.transport === "string") { data.event.transport = { transport: data.event.transport } } }
	if(data.plugindata && data.plugindata.data && data.plugindata.data.result) { 
		if (typeof data.plugindata.data.result === "string") { data.plugindata.data.result = { result: data.plugindata.data.result } }
	}

  return data;
};

exports.create = function() {
  return new FilterAppJanus();
};
