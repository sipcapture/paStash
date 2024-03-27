KafkaJS output plugin
---

Status : plugin, unit tested and maintained.

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
* ``ssl``: Set SSL to true to use tls transport. Optional.
* ``ca``: Specify Path to customer certificate authority. Optional.
* ``sasl_user``: SASL Username. Optional.
* ``sasl_pass``: SASL Password. Optional.
* ``sasl_mechanims``: SASL Mechanism. Optional. Default: 'plain' Options: 'scram-sha-256', 'scram-sha-512'
* ``debug``: Debug option. Optional.

Examples :

Configuration using SSL and SASL to authenticate and connect.

```
output {
  kafkajs {
    topic => "your-topic-here"
    kafkaHost => "receiver:9092"
    debug => false
    ssl => true
    sasl_mechanism => "plain"
    sasl_user => "pastash"
    sasl_password => "supersecretpass"
  }
}
```
