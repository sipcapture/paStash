Netflow input plugin
---

Status : experimental plugin

This plugin is used to decode Netflow Version 1,5,7,9 Packets into events. 

<!--
Config using url: ``input://netflow://?port=1234``
-->

Config using logstash format:
````
input {
  esl {
    port => 1234
  }
}
````

Parameters :
* ``host``: the Netflow server address. Optional.
* ``port``: the Netflow server port. Required.
