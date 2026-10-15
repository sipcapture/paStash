Loki push from log files (#79)
---

**Grok** is a **core** filter — use ``grok {}``, not ``@pastash/filter_grok`` (that npm
package does not exist).

Minimal working Loki pipeline:

```
input {
  file {
    path => "./logs/*.log"
    type => app
  }
}

filter {
  grok {
    match => '%{TIMESTAMP_ISO8601:timestamp}: %{GREEDYDATA:logmsg}'
  }
}

output {
  loki {
    host => localhost
    port => 3100
    path => /loki/api/v1/push
    partition_id => fake
  }
}
```

Notes:

* Loki needs valid JSON push bodies; paStash builds labels from all fields except
  ``message``, ``@timestamp``, ``@version``, ``@value``. Keep a ``type`` or ``app`` field
  on events so streams are not empty.
* HTTP **400** usually means wrong URL (use ``/loki/api/v1/push``) or missing tenant header
  on multi-tenant Loki — set ``partition_id`` (sent as ``X-Scope-OrgID``).
* Install the Loki **output plugin**: ``npm install -g @pastash/output_loki``.
