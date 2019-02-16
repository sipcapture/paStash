var abstract_http = require('./abstract_http'),
  util = require('util');

function OutputHttpPost() {
  abstract_http.AbstractHttp.call(this);
  this.mergeConfig(this.serializer_config('raw'));
  this.mergeConfig({
    name: 'Http Post',
    optional_params: ['path'],
    default_values: {
      'path': '/',
    },
  });
}

util.inherits(OutputHttpPost, abstract_http.AbstractHttp);

OutputHttpPost.prototype.process = function(data) {
  var path = this.replaceByFields(data, this.path);
  if (path) {
    var http_options = {
      port: this.port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': this.serializer === 'json_logstash' ? 'application/json' : 'text/plain'
      }
    };
    var line = this.serialize_data(data) || JSON.stringify(data);
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
};

OutputHttpPost.prototype.to = function() {
  return ' http ' + this.host + ':' + this.port;
};

exports.create = function() {
  return new OutputHttpPost();
};
