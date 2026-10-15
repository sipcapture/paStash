Audiocodes Mediant pipe CDR without header row (#230)
---

When the SBC sends pipe-separated CDR rows without a header line, define columns
with the **csv** filter and a fixed ``headers`` list, or use **regex** / **split**.

Example (csv filter with explicit headers):

```
input {
  udp {
    host => 0.0.0.0
    port => 514
    type => mediant_cdr
  }
}

filter {
  if [type] == mediant_cdr {
    csv {
      separator => "|"
      headers => RecordType,ProductName,ShelfInfo,SeqNum,SessionId,SetupTime,TimeToConnect,CallDuration,TimeZone,IngressCallingUser,EgressCallingUser,IngressDialedUser,EgressCalledUser,IngressCallSourceIp,EgressCallDestIp,EgressTrmReason,EgressSIPTrmReason,IngressSipInterfaceName,EgressSipInterfaceName,RouteAttemptNum
    }
  }
}

output {
  http_post {
    host => qryn.example.com
    port => 443
    path => /api/v1/import
  }
}
```

Strip syslog priority prefix first if needed:

```
filter {
  regex {
    regex => /^<\d+>(.*)$/
    fields => message
  }
}
```

For full SIP + QoS from Mediant, prefer ``app_audiocodes {}`` (see plugin readme).
