<img src="https://ribboncommunications.com/themes/custom/ribbon/images/logo.png">

App Sonus Monitor
---

Status : functional, experimental plugin.

The filter is used to parse/reassemble Sonus Monitor Profile messages to complete HEP-SIP payloads.

Installation:
```
# sudo npm install --unsafe-perm -g @pastash/pastash @pastash/filter_app_sonus_monitor
```


Example 1: parse SM logs.
````
input {
  udp {
    host => 0.0.0.0
    port => 8002
  }
}

filter {
  app_sonus_monitor {
     remove_headers => true
  }
}

output {
    stdout {}
    hep {
        host => HEP-SERVER-ADDRESS
        port => 9063
        hep_id => 2233
    }
}
`````


Parameters:

* ``correlation_hdr``: SIP Header to use for correlation IDs. Default : false.
  ``remove_headers``: Remove Injected Headers. Default : false.

