KafkaJS output plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to send logs to Kafka.


Config using logstash format:
````
output {
  kafkajs {
    topic => "your-topic-here"
    kafkaHost => "receiver:9092"
    debug => false
  }
}
````

Parameters :
* ``kafkaHost``: Kafka host:port sets delimited by comma, _Example: 10.0.0.1:9092,10.0.0.2:9092_. Required. 
* ``topic``: Kafka topic. Required.
* ``partition``: Field to extract and use as Partition value for indexing. Optional.
* ``sasl_user``: SASL Username. Optional.
* ``sasl_pass``: SASL Password. Optional.
* ``debug``: Debug option. Optional.
