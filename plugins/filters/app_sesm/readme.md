App SESM Filter
---

Status : experimental plugin.

The filter is used to parse/reassemble SESM Logs into InfluxDB Timeseries.

Example:
````
input {
  file {
    path => "/tmp/sesm.log"
    start_index => 0
  }
}

filter {
  app_sesm {}
}

output {
  http_post {
    host => localhost
    port => 8086
    path => "/write?db=sesm"
  }
}

`````

