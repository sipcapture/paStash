Kafka output plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to send logs to Kafka.


Config using logstash format:
````
output {
  kafka {
    topic => "your-topic-here"
    kafkaHost => "receiver:9092"
    debug => true
  }
}
````

Parameters :
* ``kafkaHost``: the Kafka host:port. Required. Example: 127.0.0.1:9092
* ``topic``: your Kafka topic. Required.
* ``debug``: Debug option. Optional.
