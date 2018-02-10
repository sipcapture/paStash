NSQ input plugin
---

Status : experimental plugin.

This plugin is used to connect a paStash Input to an NSQ Server Topic/Channel.

Config using logstash format:
````
input {
  nsq {
    host => '127.0.0.1'
    port => 4561
    topic => 'some_topic'
    channel => 'some_channel'
  }
}
````

Parameters :
* ``host``: Hostname or IP of NSQ Server.
* ``port``: Service Port of NSQ Server.
* ``topic``: NSQ Topic.
* ``channel``: NSQ Channel.
