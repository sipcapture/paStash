NSQ output plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to ship events via NSQ Topics.


Config using logstash format:
````
output {
  nsq {
    topic => "your-topic-here"
    dataUrl => "127.0.0.1"
  }
}
````

Parameters :
* ``dataUrl``: NSQ Data Url. Default: 'localhost'
* ``dataTcpPort``: NSQ TCP port. Default: 4150
* ``topic``: NSQ Topic. Default: 'test-topic'
* ``debug``: Debug option. Optional.
