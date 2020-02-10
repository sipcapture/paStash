ESL input plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to get events from [Freeswitch ESL](https://freeswitch.org). 

<!--
Config using url: ``input://ami://?host=127.0.0.1&port=5038&user=admin&pass=admin``
-->

Config using logstash format:
````
input {
  esl {
    host => "127.0.0.1"
    port => 8021
    pass => "ClueCon"
  }
}
````

Parameters :
* ``host``: the ESL server address. Required.
* ``port``: the ESL server port. Required.
* ``pass``: the ESL password. Required.
* ``wait``: the ESL timeout/retry rate.
