Influxdb output plugin
---

Status : core plugin, unit tested and maintained.

This plugin is used send data to Influxdb.

Example: to send, for each line of nginx log, a counter with value 1, key ``nginx.request``, on an influxdb instance located on port 8125.
Config using url: ``output://influxdb://localhost:8089?only_type=nginx&metric_type=counter&metric_key=nginx.request``

Config using logstash format:
````
output {
  if [type] == nginx {
    influxdb {
      host => localhost
      port => 8089
      protocol => udp
      metric_type => counter
      metric_key => nginx.request
    }
  }
}
````

Parameters:

* ``interval``: reporting interval in ms. default: 1000
* ``host``: ip of the statsd server.
* ``port``: port of the statsd server.
* ``protocol``: protocol used to communicate with server, one of: ``udp``,``http``,``https``
* ``metric_type``: one of ``histogram``, ``meter``, ``counter``, ``timer``, ``gauge``. Type of value to send to Influxdb.
* ``metric_key``: key name to send to Influxdb.
* ``metric_value``: metric value to send to Influxdb. Mandatory for ``timer``, ``counter`` and ``gauge`` type.
* ``cache_*``: cache configuration for resolving ``host``. More doc at [cache](../cache.md).

``metric_key`` and ``metric_value`` can reference log line properties (see [interpolation](../interpolation.md)).

Example: ``metric_key=nginx.response.#{status}``
