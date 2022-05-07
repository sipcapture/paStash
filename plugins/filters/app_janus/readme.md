App Janus Tracer
---

Status : functional, experimental plugin.

This pass-through plugin produces OTLP-like tracing from Janus events

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
