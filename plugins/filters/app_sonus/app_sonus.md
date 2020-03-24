App Sonus filter
---

Status : functional, experimental plugin.

The filter is used to parse/reassemble Sonus TRC logs to complete HEP-SIP payloads.

Example 1: parse SM logs.
````
filter {
  app_sonuslog {}
}
`````

Example 2: parse SM logs and extract ``correlation_hdr`` for HEP pairing.
````
filter {
  app_sonuslog {
    correlation_hdr => "X-CID"
  }
}
`````

Parameters:

* ``correlation_hdr``: SIP Header to use for correlation IDs. Default : false.
