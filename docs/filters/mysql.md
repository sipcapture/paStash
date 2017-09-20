MySQL filter
---

Status : experimental plugin, unit tested and maintained.

The MySQL filter can be used to resolve fields from a mysql database, caching the results for sequential reads.

Config using logstash format:
````
filter {
  mysql {
    db => 'db_name'
    user => 'root'
    password => 'secret'
    host => 'localhost'
    query => 'SELECT * from some_table WHERE id=(?) limit 1;'
    source_field => 'to_user'
    target_field => 'my_lookup'
  }
}
````

Parameters:

* ``db``: name of the database used for lookups.
* ``query``: SELECT query with single parameter matching.
* ``filter``: override filter for lookups, can be used to extract as #{toto}.
* ``user``: username for the connection. 
* ``password``: password for the connection. 
* ``host``: server host to connect to.
* ``port``: server port to connect to. 
* ``source_field``: which field to work on for the lookup.
* ``target_field``: field to store the result. Default: field used for resolution.
