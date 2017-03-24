MQTT input plugin
---

Status : experimental plugin.

This plugin is used on log server to receive logs from agents.

Example 1: to open a MQTT connection to server.
Config using url: ``input://mqtt://mqtt://test.moquitto.org``

Config using logstash format:
````
input {
  mqtt {
    address => ['mqtt://test.moquitto,org']
  }
}
````

Parameters :
* ``address``: MQTT server address.
* ``topic``: MQTT PubSub Topic.
* ``unserializer``: more doc at [unserializers](unserializers.md). Default value to ``json_logstash``. This plugin does not support raw data.
