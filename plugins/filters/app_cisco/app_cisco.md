App Cisco ISR filter
---

Status : functional, experimental plugin.

#### NPM
```
# sudo npm install --unsafe-perm -g @pastash/pastash @pastash/filter_app_cisco
```

#### Recipe Example
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


