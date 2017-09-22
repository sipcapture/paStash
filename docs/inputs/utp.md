UTP input plugin
---

Status : core plugin, unit tested and maintained.

This plugin is used on log server to receive data over UTP (libutp).

Example 1:
Config using url: ``input://utp://0.0.0.0:12345``

Config using logstash format:
````
input {
  utp {
    host => 0.0.0.0
    port => 12345
  }
}
````


Parameters:

* ``host``: listen address for the utp server : can be 0.0.0.0, 127.0.0.1 ...
* ``port``: port for the utp server.
* ``type``: to specify the log type, to faciliate crawling in kibana. Example: ``type=utp``. No default value.
* ``unserializer``: more doc at [unserializers](unserializers.md). Default value to ``json_logstash``.
