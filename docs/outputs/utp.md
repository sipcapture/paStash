UTP output plugin
---

Status : core plugin, unit tested and maintained.

This plugin is used on log clients to send data over UTP (libutp).

Example 1:
Config using url: ``output://utp://192.168.1.1:12345``

Config using logstash format:
````
output {
  utp {
    host => 192.168.1.1
    port => 12345
  }
}
````

Parameters:

* ``host``: ip of the utp server.
* ``port``: port of the utp server.
* ``serializer``: more doc at [serializers](serializers.md). Default value to ``json_logstash``.
* ``format``: params used by the ``raw`` [serializer](serializers.md).
