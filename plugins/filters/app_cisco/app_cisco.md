App Cisco ISR / CUBE filter
---

Status : functional, experimental plugin.

Parses Cisco IOS / ISR-style ``ccsipDisplayMsg`` syslog (including many **CUBE** SIP debug
streams). Point syslog (UDP or TCP with ``unserializer => raw``) at paStash, use
``multiline`` for multi-line SIP bodies, then ``app_cisco {}`` before ``hep`` output.
See the recipe below; adjust ``start_line_regex`` if your CUBE firmware uses a slightly
different timestamp or prefix format.

#### NPM
```
# sudo npm install --unsafe-perm -g @pastash/pastash @pastash/filter_app_cisco
```

#### Recipe Example
```
input {
  udp {
    host => 0.0.0.0
    port => 9515
    type=> syslog
  }
}
filter {
        if [udp_port] == 9515  {
                multiline {
                  start_line_regex => /^<\d+?>\d+:\s(\*|)[A-Za-z]{3}\s{1,2}\d{1,2}\s\d{2}:\d{2}:\d{2}\.\d+.*ccsipDisplayMsg:/
                }
                app_cisco{}
        }
}
output {
        hep {
          host => '127.0.0.1'
          port => 9060
          hep_id => 2223
          hep_type => 1
        }
}


```
