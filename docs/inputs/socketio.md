SocketIO input plugin
---

Status : beta version of SocketIO .

This plugin is used on log server to receive logs from an HTTP/HTTPS  SocketIO stream. 
This is useful in case of  aneed of geeting streams from browser .

make sure you download socketio
```
npm install socket.io
```
Config using logstash format:
```
input {
  socketio {
      host => 127.0.0.1
      port => 8013
    }
}
```

Example Output:
```
{
  "message": {
    "level": 2,
    "time": "2017-11-12T02:32:24.246Z",
    "message": "\"Hello from My website client ....\""
  },
  "host": "127.0.0.1",
  "ws_port": "8013",
  "@timestamp": "2017-11-12T02:32:24.552Z",
  "@version": "1"
}

```

Parameters:

* ``host``: listen address for the HTTP server : can be 0.0.0.0, 127.0.0.1 ...
* ``port``: port for the HTTP server.
* ``type``: to specify the log type, to faciliate crawling in kibana. Example: ``type=http``. No default value.
* ``unserializer``: more doc at [unserializers](unserializers.md). Default value to ``json_logstash``.
* ``ssl``: enable SSL mode. More doc at [ssl](../ssl.md). Default : false
* ``path``: strict path mapping for the HTTP server. Example: ```/api```. Default: false.

