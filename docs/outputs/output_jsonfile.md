JSON File output plugin
---

Status : core plugin, unit tested and maintained.

This plugin is used to write json data into files. 

Example 1: to write each ``janus`` log line as JSON to ``/var/log/janus.log``.
Config using url: ``output://jsonfile:///var/log/janus.log?only_type=janus``

Config using logstash format:
````
output {
  if [type] == jsnus {
    file {
      path => "/var/log/janus.log"
    }
  }
}
````

Parameters:

* ``path``: the target file path. Default: /tmp/pastash.log
* ``append``: append data the target path. Default: true.
