![image](https://user-images.githubusercontent.com/1423657/167949173-7ff587b8-9ebf-4f1c-9430-2121518405b7.png)

App Janus SIP
---

Status : functional plugin.

This pass-through plugin produces HEP from SIP sent via the Janus SIP Plugin.


Example 1: parse janus events as hep.
````
filter {
  app_janus_tracer {
    debug => true
  }
}
`````


Supported optionas are:

'debug' => true for debugging loggers
