paStash RFC3339 filter (rust)
---

Status : functional, experimental plugin.

## RFC3339 Filter

Convert between RFC3339 and microsecond/nanosecond timestamps

##### RFC3339 to Nanosecond TS
```
filter {
  rfc3339 {
    source => rfc3339
    target => nano_ts
    mode => 0
  }
}
```

| "2018-12-18T08:28:06.801064-04:00" > 1545136086801064

##### Nanosecond TS to RFC3339
```
filter {
  rfc3339 {
    source => nano_ts
    target => rfc3339
    mode => 1
  }
}
```

| 1545136086801064 > "2018-12-18T12:28:06.801064+00:00"

##### Microsecond TS to RFC3339
```
filter {
  rfc3339 {
    source => micro_ts
    target => rfc3339
    mode => 2
  }
}
```

| 1545136086801 > "2018-12-18T12:28:06.801+00:00"
