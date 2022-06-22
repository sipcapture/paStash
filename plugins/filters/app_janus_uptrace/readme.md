![image](https://user-images.githubusercontent.com/1423657/167949173-7ff587b8-9ebf-4f1c-9430-2121518405b7.png)

App Janus Tracer for uptrace/OTLP
---

Status : functional, experimental plugin.

This pass-through plugin produces Uptrace/OTLP spans from Janus events

![image](https://user-images.githubusercontent.com/1423657/167948823-a6369a07-2e84-48d0-bd82-4a801ddf0d76.png)


Example 1: parse janus logs and send them to an uptrace instance
```
filter {
  app_janus_uptrace {
    endpoint => "http://token@uptrace.host.ip:14318/<project_id>"
    bypass => true
  }
}
```

Parameters:

* `endpoint`: Uptrace DSN address
* `bypass`: Pass-Through raw messages post processing
* `service_name`: Identifying service name. Default "pastash-janus".
* `filter`: An array of event types you want traced. Default: ["1", "128", "2", "4", "8", "16", "32", "64", "256"].
