Loki output plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to send logs to Loki.

## Requirements 
* Grafana + Loki (or cLoki)


### Config using Local Loki
````
input {
  file {
    path => "/var/log/nginx/access.log"
  }
}

output {
  loki {
    host => localhost
    port => 3100
    path => "/api/prom/push"
  }
}
````

### Hosted Grafana Example
```
input {
  file {
    path => "/var/log/*"
  }
}

output {
  loki {
    basic_auth_password => "some_very_secure_password_hash_here"
    basic_auth_user => "1234"
    host => "logs-us-west1.grafana.net"
    port => 80
    path => "/api/prom/push"
  }
}
```

Parameters:

* ``host``: ip of the target HTTP server. Accepts string (single) or Array (multi-target).
* ``port``: port of the target HTTP server. Same for all ips if Array.
* ``path``: path to use in the HTTP request. Can reference log line properties (see [interpolation](../interpolation.md)).
* ``serializer``: more doc at [serializers](serializers.md). Default value to ``raw``.
* ``format``: params used by the ``raw`` [serializer](serializers.md).
* ``ssl``: enable SSL mode. More doc at [ssl](../ssl.md). Default : false
* ``proxy``: use http proxy. More doc at [http proxy](http_proxy.md). Default : none.
* ``basic_auth_user`` and ``basic_auth_password``: user and password for HTTP Basic Auth required by server. Default: none.
* ``maxAge``: maximum bulk cache age in milliseconds. Default 1000.
* ``maxSize``: maximum bulk entries before flush. Default 5000.
* ``basic_auth_user``: HTTP Basic Auth Username
* ``basic_auth_password``: HTTP Basic Auth Password
* ``partition_id``: Optional value for X-Scope-OrgID header
