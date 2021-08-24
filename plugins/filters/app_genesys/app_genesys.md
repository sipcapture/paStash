App Genesys filter
---

Status : functional, experimental plugin.

The filter is used to parse/reassemble Genesys logs to complete HEP-SIP payloads.

Tested with SIP Server, Version: 8.1.103.74 / Genesys SIP Library 8.5.000.02


Example 1: parse SM logs.
````
filter {
  app_genesys {}
}
`````

Example 2: parse SM logs and extract ``correlation_hdr`` for HEP pairing.
````
filter {
  app_genesys {
    correlation_hdr => "X-Genesys-CallUUID"
  }
}
`````

Parameters:

* ``correlation_hdr``: SIP Header to use for correlation IDs. Default : false.
