/*
   Janus Event Tracer
   (C) 2022 QXIP BV
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var recordCache = require("record-cache");
var fetch = require('node-fetch');


function nano_now(date){ return (date * 1000) + '000' }
function just_now(){ return new Date().getTime() }

function FilterAppJanusTracer() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'AppJanusTracer',
    optional_params: ['debug', 'cacheSize', 'cacheAge', 'endpoint'],
    default_values: {
      'cacheSize': 50000,
      'cacheAge':  60000,
      'endpoint': 'http://localhost:3100/tempo/api/push',
      'bypass': true,
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

  var sessions = recordCache({
    maxSize: this.cacheSize,
    maxAge: this.cacheAge,
    onStale: false
  });
  this.sessions = sessions;

  logger.info('Initialized App Janus Event Tracer');
  callback();
};

FilterAppJanusTracer.prototype.process = function(data) {
   if (!data.message) return data;
   var line = data.message;

   if (!line.session_id || !line.handle_id) return data;

   if (line.type == 1){
	var event = { name: line.event.name, event: line.event.name, id: line.session_id }
	if (line.event.name == "created"){
		// start root trace, do not update
		this.sessions.add(event.session_id, just_now());
	} else if (line.event.name == "destroyed"){
		// end root trace
		this.sessions.remove(event.session_id);
	}

   } else if (line.type == 2) {
	if (!line.event.data) return;
	var event = { name: line.event.name, event: line.event.name, id: line.session_id, handle: line.handle_id }
	// session tracing + reset
	var previous_ts = this.cache.get(event.session_id, 1)[0] || 0;
	event.duration = just_now() - parseInt(previous_ts);
	this.cache.add(event.session_id, just_now());

	if(event.name == "attached") {
		// session_id, handle_id, opaque_id
	} else if (event.name == "detached") {
		// session_id, handle_id, opaque_id
		this.cache.add(event.handle_id, just_now());
	}

   } else if (line.type == 64){
	if (!line.event.data) return data;
	var event = { name: line.event.plugin, event: line.event.data.event, id: line.event.data.id, handle: line.handle_id }
	// session tracing + reset
	var previous_ts = this.cache.get(event.session_id, 1)[0] || 0;
	event.duration = just_now() - parseInt(previous_ts);
	this.cache.add(event.session_id, just_now());

	if (event.event == "joined"){
		// session_id, handle_id, opaque_id, event.data.id
		// correlate: session_id --> event.data.id
		this.cache.add(event.data.id, session_id);
	} else if (event.event == "configured"){
		// session_id, handle_id, opaque_id, event.data.id
	} else if (event.event == "published"){
		// session_id, handle_id, opaque_id, event.data.id
		this.cache.add(event.data.id, session_id);
	} else if (event.event == "unpublished"){
		// correlate: event.data.id --> session_id
		event.session_id = this.cache.get(fingerprint_event, 1)[0] || false;
		line.session_id = event.session_id;
	} else if (event.event == "leaving"){
		// correlate: event.data.id --> session_id
		event.session_id = this.cache.get(fingerprint_event, 1)[0] || false;
		line.session_id = event.session_id;
		this.cache.delete(event.data.id)
	}

	event.timestamp = line.timestamp;
	var trace = tracegen(event, this.endpoint)
	if (!this.bypass) this.emit('output', trace)

   }
   if (this.bypass) this.emit('output', data);

};

exports.create = function() {
  return new FilterAppJanusTracer();
};

async function tracegen(event, endpoint){
  try {
    var trace = [{
	 "id": event.id,
	 "traceId": event.traceId,
	 "timestamp": nano_time(event.timestamp),
	 "duration": event.duration,
	 "name": event.name,
	  "localEndpoint": {
	    "serviceName": event.service
	  }
    }]
    if (event.parentId){ trace[0].parentId }
    if (event.tags){ trace[0].tags }

    // send event to endpoint
    if(endpoint){

	const response = await fetch(endpoint, {
	  method: 'POST',
	  body: JSON.stringify(trace),
	  headers: {'Content-Type': 'application/json'}
	});
	const data = await response.json();
    } else {
	return trace
    }

  } catch(e) { console.log(e); return; }
}
