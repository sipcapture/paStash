var abstract_http = require('./abstract_http'),
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var recordCache = require('record-cache');

var cache;

function LokiPost() {
  abstract_http.AbstractHttp.call(this);
  this.mergeConfig(this.serializer_config('raw'));
  this.mergeConfig({
    name: 'Loki',
    optional_params: ['path', 'maxSize', 'maxAge', 'partition_id'],
    default_values: {
      'path': '/',
      'maxSize': 5000,
      'maxAge': 1000,
      'partition_id': false
    },
    start_hook: this.start,
  });
}

LokiPost.prototype.start = function(callback) {
  /* Bulk Helper */
  this.onStale = function(data){
        for (let [key, value] of data.records.entries()) {
             if(!value.list[0]) return;
             var line = {"streams": [{"labels": "", "entries": [] }]};
             line.streams[0].labels = key;
             value.list.forEach(function(row){
                // add to array
                row = row.record;
                var resp = { "ts": row['@timestamp']||new Date().toISOString() };
                if (row.message){ resp.line = row.message; }
                if (row.value)  { resp.value = row.value; }
                line.streams[0].entries.push(resp);
             });
             line = JSON.stringify(line);
             var path = this.replaceByFields(data, this.path);
                if (path) {
                  var http_options = {
                    port: this.port,
                    path: path,
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  };
                  if (this.partition_id) http_options.headers['X-Scope-OrgID'] = this.partition_id;
                  if (line) {
                    http_options.headers['Content-Length'] = Buffer.byteLength(line, 'utf-8');
                    if ( typeof this.host !== 'string' ) {
                      for (var i = 0, len = this.host.length; i < len; i++){
                         http_options.host = this.host[i];
                         this.sendHttpRequest(http_options, line);
                      }
                    } else {
                         http_options.host = this.host;
                         this.sendHttpRequest(http_options, line);
                    }
                  }
                }
        }
  }.bind(this)

  this.cache = recordCache({
          maxSize: this.maxSize,
          maxAge: this.maxAge,
          onStale: this.onStale
  })
  cache = this.cache;
  callback();
};

util.inherits(LokiPost, abstract_http.AbstractHttp);

LokiPost.prototype.process = function(data) {
        // Group by Labels fingerprint        
        var labels = [];
        const stripped = Object.entries(data)
                .filter(([key]) => !['message', '@timestamp', '@version'].includes(key))
                .reduce((data, [key, val]) => Object.assign(data, { [key]: val }), {});
        Object.keys(stripped).forEach(key => {
          labels.push( key+"=\""+stripped[key]+"\"" );
        });
        var fingerprint = "{"+labels.join(',')+"}";
        cache.add(fingerprint,data);
};

LokiPost.prototype.to = function() {
  return ' LOKI http ' + this.host + ':' + this.port + '' + this.path;
};

exports.create = function() {
  return new LokiPost();
};
