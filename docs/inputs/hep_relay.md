HEP UDP relay (forwarder)
---

Status : documented pattern (core UDP in/out)

paStash defaults to JSON logstash wrapping on UDP I/O. To **forward binary HEP3**
packets unchanged (rtpproxy, heplify, samplicator-style relay), use **raw**
serializer/unserializer and pass the UDP payload through the ``message`` field:

```
input {
  udp {
    host => 0.0.0.0
    port => 9060
    unserializer => raw
  }
}

output {
  udp {
    host => homer.example.com
    port => 9060
    serializer => raw
    format => #{message}
  }
  udp {
    host => homer-backup.example.com
    port => 9060
    serializer => raw
    format => #{message}
  }
}
```

Do **not** use the default ``json_logstash`` path for HEP relay; it will JSON-encode
the binary payload and Homer will not decode it.

For AMQP hops, use ``msgpack`` or ``raw`` consistently on both sides of the queue.
