App Sonus Monitor
---

Status : functional, experimental plugin.

The filter is used to parse/reassemble Sonus Monitor Profile messages to complete HEP-SIP payloads.

Example 1: parse SM logs.
````
filter {
  app_sonus_monitor {}
}
`````

Example 2: parse SM logs and extract ``correlation_hdr`` for HEP pairing.
````
filter {
  app_sonus_monitor {
    correlation_hdr => "X-CID"
    remove_headers => true
  }
}
`````

Parameters:

* ``correlation_hdr``: SIP Header to use for correlation IDs. Default : false.
