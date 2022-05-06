/*
   Janus Event Tracer
   (C) 2022 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var recordCache = require("record-cache");

function nano_now(date){ return (date * 1000) + '000' }
function just_now(){ return new Date().getTime() }

function FilterAppJanusTracer() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppJanusTracer',
    optional_params: ['debug', 'cacheSize', 'cacheAge'],
    default_values: {
      'cacheSize': 50000,
      'cacheAge':  60000,
      'debug': false
    },
    start_hook: this.start,
  });
}

util.inherits(FilterAppJanusTracer, base_filter.BaseFilter);

FilterAppJanusTracer.prototype.start = async function(callback) {

  var cache = recordCache({
    maxSize: this.cacheSize,
    maxAge: this.cacheAge,
    onStale: false
  });
  this.cache = cache;

  logger.info('Initialized App Janus Event Tracer');
  callback();
};

FilterAppJanusTracer.prototype.process = function(data) {
   if (!data.message) return data;
   var line = data.message;

   if (!line.session_id || !line.handle_id) return data;

   if (line.type == 1){
        var fingerprint = event.session_id;
	var event = { name: line.event.name, event: line.event.name, id: line.session_id }
	if (line.event.name == "created"){
		// start root trace
		this.cache.add(fingerprint, just_now());
	} else if (line.event.name == "destroyed"){
		// end root trace
		this.cache.remove(fingerprint);
	}

   } else if (line.type == 64){
	if (!line.event.data) return;
	var event = { name: line.event.plugin, event: line.event.data.event, id: line.event.data.id }

	if (event.event == "joined"){
		// session_id, handle_id, opaque_id, event.data.id
		this.cache.add(event.data.id, session_id);
	} else if (event.event == "configured"){
		// session_id, handle_id, opaque_id, event.data.id
	} else if (event.event == "published"){
		// session_id, handle_id, opaque_id, event.data.id
		this.cache.add(event.data.id, session_id);
	} else if (event.event == "unpublished"){
		// event.data.id
		event.session_id = this.cache.get(fingerprint_event, 1)[0] || false;
	} else if (event.event == "leaving"){
		// event.data.id
		event.session_id = this.cache.get(fingerprint_event, 1)[0] || false;
		this.cache.delete(event.data.id)
	}

   	var fingerprint_event = line.event.handle_id;
	var cache = this.cache.get(fingerprint_event, 1);
	// find parent id
	if (cache.length < 1) {
		this.cache.add(fingerprint_event, just_now());
	} else {
		event.parentId = line.session_id
	}
	// get previous ts
	event.duration = just_now() - parseInt(cache[0]);
	event.timestamp = line.timestamp;
	event.tags = { room: event.room, event: event.event, display: event.display }
	var trace = tracegen(event)
	this.emit('output', trace)
	// update ts
        this.cache.add(fingerprint, just_now());
   } else if(line.type == 2) {
	if (!line.event.data) return;
	var event = { name: line.event.name }
	if(event.name == "attached") {
		// session_id, handle_id, opaque_id
		this.cache.add(event.name, session_id);
	} else if (event.name == "detached") {
		// session_id, handle_id, opaque_id
		event.session_id = this.cache.get(fingerprint_event, 1)[0] || false;
		this.cache.delete(event.name)
	}
   }
   return data;
};

exports.create = function() {
  return new FilterAppJanusTracer();
};

function tracegen(event){
  if (event.root || !event.parentId){
    var trace = [{
	 "id": event.room,
	 "traceId": event.id,
	 "timestamp": nano_time(event.timestamp),
	 "duration": event.duration,
	 "name": event.event,
	 "tags": event.tags,
	  "localEndpoint": {
	    "serviceName": event.emitter
	  }
    }]
    return trace;
  } else {
    var trace = [{
	 "id": event.room,
	 "traceId": event.id,
	 "parentId": event.parentId,
	 "timestamp": nano_time(event.timestamp),
	 "duration": event.duration,
	 "name": event.event,
	  "localEndpoint": {
	    "serviceName": event.emitter
	  }
    }]
    return trace;
  }
}
