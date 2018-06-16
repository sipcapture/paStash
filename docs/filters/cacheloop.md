Cacheloop filter
---

Status : core plugin, unit tested and maintained.

The CacheLoop filter provides aggregation features within a pipeline implemented as an LRU collecting same key objects and emitting groups upon expiration or eviction.

Example: aggregate documents with the same 'correlation_id' keys in a 5s range.
````
filter {
  if [status] == 10 {
    cacheloop {
      cacheAge: 5000
      extract => 'correlation_id'
      bypass => false
      custom_type => 'unified'
    }
  }
}
`````

Parameters:

* ``extract``: which field to work on for grouping. Mandatory.
* ``cacheSize``: maximum size for records before eviction. Default: 5000
* ``cacheAge``: maximum age for records in cache in millisecods. Default: 10000
* ``bypass``:Let records pass through other pipes, causing duplication. Default: false
* ``custom_type``: inject a custom 'type' tag in output. Default: false.
