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
* ``whitelist``: remove all fields except those in whitelist from cached object. Default: false.
* ``blacklist``: keep all fields except those in blacklist from cached object.. Default: false.
* ``average``: array with numeric fields to be averaged across a group. Default: false.
* ``rename``: rename data group with an arbitrary name. Default: false.
