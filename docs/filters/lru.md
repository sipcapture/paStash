LRU filter
---

Status : core plugin, unit tested and maintained.

The LRU filter allows caching and retrieval of values and correlation vectors in a filter pipeline.

Config using logstash format:
```
filter {
 if [type] == 1 {
   lru {
       cache_shared => true
       action => set
       field => session
       value_field => event
     }
 }
 if [type] == 2 {
   lru {
       cache_shared => true
       action => get
       field => session
       target_field => correlation
   }
 }
}

```

Parameters:

* ``action``: which action to perform [set,get].
* ``field``: which field to work on.
* ``target_field``: field to store the result. Default: field used for resolution.
* ``cache_shared``: share LRU cache between Filters. Default: false.
* ``cache_*``: cache configuration. More doc at [cache](../cache.md).
