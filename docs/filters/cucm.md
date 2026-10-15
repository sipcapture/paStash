CUCM CDR/CMR filter
---

Status : core plugin

Parses **comma-separated** lines from Cisco Unified Communications Manager CDR/CMR
export files. The first line in the stream must be the standard header row starting
with ``cdrRecordType``; subsequent lines become structured fields.

Typical pipeline:

```
input {
  file {
    path => "/var/log/cucm/CDR/*.csv"
  }
}

filter {
  cucm {}
}

output {
  elasticsearch {
    host => localhost
    port => 9200
    index => cucm-%{+YYYY.MM.dd}
  }
}
```

Parameters:

* ``separator``: field separator. Default: ``','`` (CUCM default).

Record type ``cdrRecordType`` ``1`` sets ``type`` to ``cucm_cdr``; ``2`` sets ``cucm_cmr``.
