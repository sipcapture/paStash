AMI input plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to get events from [Asterisk AMI](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+AMI+Events). 

<!--
Config using url: ``input://ami://?host=127.0.0.1&port=5038&user=admin&pass=admin``
-->

Config using logstash format:
````
input {
  ami {
    host => "127.0.0.1"
    port => 5038
    user => "admin"
    pass => "admin"
  }
}
````

Parameters :
* ``host``: the AMI server address. Required.
* ``port``: the AMI server port. Required.
* ``user``: the AMI username. Required.
* ``pass``: the AMI password. Required.
