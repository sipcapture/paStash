App Janus Tracer
---

Status : functional, experimental plugin.

This pass-through plugin produces Zipkin-like OTLP tracing from Janus events

![image](https://user-images.githubusercontent.com/1423657/167948823-a6369a07-2e84-48d0-bd82-4a801ddf0d76.png)


Example 1: parse janus logs.
````
filter {
  app_janus_tracer {
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
