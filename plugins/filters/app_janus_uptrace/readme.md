![image](https://user-images.githubusercontent.com/1423657/167949173-7ff587b8-9ebf-4f1c-9430-2121518405b7.png)

App Janus Tracer for uptrace/OTLP
---

Status : functional, experimental plugin.

This pass-through plugin produces Uptrace/OTLP spans from Janus events

![image](https://user-images.githubusercontent.com/1423657/167948823-a6369a07-2e84-48d0-bd82-4a801ddf0d76.png)


Example 1: parse janus logs.
````
filter {
  app_janus_uptrace {
    endpoint => http://localhost:3100/tempo/api/push
    bypass => true
  }
}
`````

Parameters:

* `endpoint`: Tempo/Zipkin Receiver for events
* `bypass`: Pass-Through raw messages post processing
* `metrics`: Enable Prometheus exporter. Default false.
* `port`: Port for Prometheus exporter
* `service_name`: Service name tag for Prometheus exporter
* `interval`: Prometheus exporter interval in ms. Default 10000.
