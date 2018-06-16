Cacheloop filter
---

Status : core plugin, unit tested and maintained.

The CacheLoop filter provides aggregation features within a pipeline implemented as an LRU collecting same key objects and emitting groups upon expiration or eviction.

Example: aggregate documents with the same 'correlation_id' keys in a 5s range.
````
filter {
  if [status] == 10 {
    cacheloop {
      maxAge: 5000
      extract => correlation_id
      bypass => false
    }
  }
}
`````

Parameters:

* ``extract``: which field to work on for grouping. Mandatory.
* ``cacheSize``: maximum size for records before eviction. Default: 5000
* ``cacheAge``: maximum age for records in cache in millisecods. Default: 10000
* ``bypass``:Let records pass through, causing duplication. Default: false
