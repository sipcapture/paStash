App Janus Tracer
---

Status : functional, experimental plugin.

This plugin produces OTLP-like tracing from Janus events

Example 1: parse janus logs.
````
filter {
  app_janus_tracer {
    endpoint => http://localhost:3100/tempo/api/push
  }
}
`````

Parameters:

* `endpoint`: Tempo/Zipkin Receiver for events
