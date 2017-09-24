App Sonus SBC Log filter
---

Status : functional, experimental plugin.

The filter is used to parse/reassemble Sonus SBC logs to complete HEP-SIP payloads.

Example 1: parse SM logs.
````
filter {
  app_sonus {}
}
`````

Example 2: parse SM logs and extract ``correlation_hdr`` for HEP pairing.
````
filter {
  app_sonus {
    correlation_hdr => "X-CID"
  }
}
`````

Parameters:

* ``correlation_hdr``: SIP Header to use for correlation IDs. Default : 'Call-ID|Call-Id'.
