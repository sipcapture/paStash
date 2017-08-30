Bencode input plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to decode Bencode messages receive data over a udp socket.

Example 1: Regular mode:
Config using url: ``input://bencode://0.0.0.0:12345``

Config using logstash format:
````
input {
  bencode {
    host => 0.0.0.0
    port => 12345
  }
}
````

Parameters:

* ``host``: listen address for the bencode udp server : can be 0.0.0.0, 127.0.0.1 ...
* ``port``: port for the ws server.
* ``type``: to specify the log type, to faciliate crawling in kibana. Example: ``type=tls``. No default value.
* ``unserializer``: more doc at [unserializers](unserializers.md). Default value to ``json_logstash``.
