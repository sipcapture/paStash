App Audiocodes filter
---

Status : functional, experimental plugin.

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
