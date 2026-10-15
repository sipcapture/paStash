Filter NetFlow by L4 source port (#236)
---

NetFlow events are parsed into fields (including ``l4_src_port``). Use a conditional
output block — no special filter plugin is required:

```
input {
  netflowv9 {
    host => 0.0.0.0
    port => 9995
  }
}

output {
  if [l4_src_port] == 5060 {
    elasticsearch {
      host => elastic.example.com
      port => 9200
      index => netflow-sip-%{+YYYY.MM.dd}
    }
  }
}
```

URL-style outputs support ``only_field_equal_l4_src_port=5060`` on the output URL.
See [common_params](../common_params.md).
