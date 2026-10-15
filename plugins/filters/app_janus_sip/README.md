![image](https://user-images.githubusercontent.com/1423657/167949173-7ff587b8-9ebf-4f1c-9430-2121518405b7.png)

App Janus SIP
---

Status : functional plugin.

This pass-through plugin produces HEP from SIP Events sent via the Janus SIP Plugin.


Example 1: parse janus events as hep.
````
input {
  ws {
    host => 0.0.0.0
    port => 8090
    unserializer => raw
  }
}

filter {
  app_janus_sip {
   debug => true
  }
}

output {
 hep {
    host => 127.0.0.1
    port => 9060
    hep_id => 2022
    hep_type => 1
  }
}
`````


Supported options are:

'debug' => true for debugging loggers

### Janus Config

To enable events, one must add the websocket eventhandler.
The recommended settings are as below:

janus.jcfg
```
broadcast = true
combine_media_stats = true
stats_period = 15
```

janus.eventhandler.wsevh.jcfg
```
enable = true
grouping = false
json = "plain"
backend = "ws://pastash.is.here:8090"
```
