![image](https://user-images.githubusercontent.com/1423657/167949173-7ff587b8-9ebf-4f1c-9430-2121518405b7.png)

App Janus Tracer
---

Status : functional, experimental plugin.

This pass-through plugin produces Zipkin-like cLoki/Tempo tracing from Janus events

![image](https://user-images.githubusercontent.com/1423657/167948823-a6369a07-2e84-48d0-bd82-4a801ddf0d76.png)


Example 1: parse janus events as traces.
````
filter {
  app_janus_tracer {
    metrics => false
    kafkaHost => "127.0.0.1:9092"
  }
}
`````

Example 2: parse janus events as traces and generate metrics.
````
filter {
  app_janus_tracer {
    metrics => true
    kafkaHost => "127.0.0.1:9092"
  }
}
`````
