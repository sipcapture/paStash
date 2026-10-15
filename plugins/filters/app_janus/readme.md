![image](https://user-images.githubusercontent.com/1423657/167949173-7ff587b8-9ebf-4f1c-9430-2121518405b7.png)

App Janus Tracer
---

Status : functional plugin.

This pass-through plugin produces Zipkin-like cLoki/Tempo tracing from Janus events
As well as Metrics from Janus Media Reports

It supports either a Kafka client or direct sending of http posts to logql style
tempo and metric logs api's. (Such as QRYN/cLoki)

![image](https://user-images.githubusercontent.com/1423657/167948823-a6369a07-2e84-48d0-bd82-4a801ddf0d76.png)


Example 1: parse janus events as traces.
````
filter {
  app_janus_tracer {
    metrics => false
    kafkaSending => false
    kafkaHost => "127.0.0.1:9092"
    httpSending => true
    httpHost => "127.0.0.1:3100"
  }
}
`````

Example 2: parse janus events as traces and generate metric logs for graphing media reports.
````
filter {
  app_janus_tracer {
    metrics => true
    kafkaSending => false
    kafkaHost => "127.0.0.1:9092"
    httpSending => true
    httpHost => "127.0.0.1:3100"
  }
}
`````

Supported optionas are:

'debug' => true for debugging loggers
'bufferSize' => determine size of the message buffer Default: 15
'metrics' => set to true to enable sending metrics from media reports Default: false
'filter' => an array of strings, only allow events to be processed by type number, Default: All events
'tracerName' => a string to name the tracer
'kafkaSending' => set to true if the target is a instance of kafka Default: false
'kafkaHost' => specify the Kafka Host address Default: 127.0.0.1:9092
'httpSending' => set to true if http post is to be used Default: true
'httpHost'=> specify the httpHost:port for the cloki/qryn receiver Default: 127.0.0.1:3100
