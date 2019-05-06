CSV Output filter plugin
---

Status : experimental plugin, unit tested and maintained.

This filter plugin is used to convert JSON object into CSV streams for file spooling.

Config using logstash format:
````
filter {
  csvout {}
}

output {
  file {
    path => "/tmp/pastash_out_#{now:YYYY-MM-DD_HH:mm}.csv"
  }
}
````

Parameters :
* ``fields`` : Array with JSON fields to use as columns. Mandatory!
* ``header`` : Print out CSV Headers, default false
* ``flatten`` : Flatten nested JSON objects, default true

