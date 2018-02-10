Omit filter
---

Status : core plugin, unit tested and maintained.

The omit filter is used to drop or pick keys from objects using either a blacklist or whitelist.

Example 1: drop all fields in blacklist

Config a blacklist using logstash format:
````
filter {
  omit {
    blacklist => ['message', 'remove_me']
  }
}
````

Example 2: keep only fields in whitelist

Config a whitelist using logstash format:
````
filter {
  omit {
    whitelist => ['message', 'keep_me']
  }
}
````

Parameters:

* ``blacklist``: Array of keys to remove.
* ``whitelist``: Array of keys to keep.
