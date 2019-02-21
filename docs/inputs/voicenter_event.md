Voicenter Event input plugin
---

Config using logstash format:
````
input {
  voicenter_event {
      api => ["http://127.0.0.1:1000", "http://127.0.0.1:2000"],
      token => "token"
  }
}
````

Parameters :
* ``api``: the api servers array. Required.
* ``token``: the token. Required.
