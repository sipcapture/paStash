SQLITE3 filter
---

Status : experimental plugin, unit tested and maintained.

The Sqlite3 filter can be used to resolve fields from an sqlite database, caching the results for sequential reads.

Config using logstash format:
````
filter {
  sqlite {
    db => '/path/to/sqlite.db'
    query => 'SELECT * from some_table WHERE id=(?) limit 1;'
    source_field => 'to_user'
    target_field => 'my_lookup'
  }
}
````

Parameters:

* ``db``: path to the sqlite3 db used for lookups.
* ``query``: SELECT query with single parameter matching.
* ``filter``: override filter for lookups, can be used to extract as #{toto}.
* ``source_field``: which field to work on for the lookup.
* ``target_field``: field to store the result. Default: field used for resolution.
