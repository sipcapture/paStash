paStash IP Port to Protocol filter (rust)
---

Status : functional, experimental plugin.

## IP Proto Filter

Resolves a port number to IP protocol


### Installation

Install the plugin globally _(mandatory)_

```
npm install -g @pastash/filter_ip_proto
```

##### Example
```
filter {
  ip_proto {
    source_field => l4_dst_port
    target_field => proto
    custom => "8883:mqtt,1194:ovpn"
  }
}
```
