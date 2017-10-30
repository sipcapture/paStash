PCAP input plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to get TCP/UDP packet data from a PCAP socket. 

Example 1: capture UDP SIP Messages

Config using logstash format:
````
input {
  pcap {
    bpf_filter => "udp and port 5060"
    device_ip => "10.0.0.1"
    binary => false
  }
}
````

Parameters :
* ``bpf_filter``: the capture BPF filter. Required.
* ``device_ip``: the IP of the capture device. Default first non-local.
* ``buf_size``: the PCAP buffer size.
* ``binary``: the output format. True for buffers, False for utf8. Default: false.
* ``debug``: enable debug messages. Default false.
* ``unserializer``: more doc at [unserializers](unserializers.md). Default value to ``json_logstash``.
