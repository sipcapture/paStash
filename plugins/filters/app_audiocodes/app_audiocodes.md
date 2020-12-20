App Audiocodes filter
---

Status : functional, experimental plugin.

### Installation
```
npm install -g @pastash/filter_app_audiocodes
```

### Usage
The filter is used to parse/reassemble Audiocodes Syslog events to complete HEP-SIP payloads.

Example 1: parse SIP logs.
````
filter {
  app_audiocodes {}
}
`````

Example 2: parse SIP logs and extract ``correlation_hdr`` for HEP pairing.
````
filter {
  app_audiocodes {
    correlation_hdr => "X-CID"
  }
}
`````

Parameters:

* ``correlation_hdr``: SIP Header to use for correlation IDs. Default : false.
* ``correlation_contact``: Auto-Extract correlation from Contact x-c. Default : false.
* ``localip``: Replacement IP for SBC Aliases. Default : 127.0.0.1.
* ``localport``: Replacement port for SBC Aliases. Default : 5060.
* ``debug``: Enable debug logs. Default : false.
