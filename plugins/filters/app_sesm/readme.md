App SESM Filter
---

Status : experimental plugin.

This filter is used to parse/reassemble SESM Logs into InfluxDB Timeseries.

#### Setup
```
npm install -g @pastash/pastash @pastash/filter_app_sesm
```


#### Example
Create a configuration file in `/opt/pastash_sesm.config` and add your log and InfluxDB details:
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

#### Usage
```
pastash --config_file=/opt/pastash_sesm.config
```
