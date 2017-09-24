App Avaya filter
---

Status : functional, experimental plugin.

The filter is used to parse/reassemble Avaya SM logs to complete HEP-SIP payloads.

Example 1: parse SM logs.
````
filter {
  app_avaya {}
}
`````

Example 2: parse SM logs and extract ``correlation_hdr`` for HEP pairing.
````
filter {
  app_avaya {
    correlation_hdr => "X-CID"
  }
}
`````

Parameters:

* ``correlation_hdr``: SIP Header to use for correlation IDs. Default : false.
