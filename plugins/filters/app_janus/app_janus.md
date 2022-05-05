App Janus Tracer
---

Status : functional, experimental plugin.

This plugin produces OTLP-like tracing from Janus events

Example 1: parse janus logs.
````
filter {
  app_janus_tracer {}
}
`````

Parameters:

* none
