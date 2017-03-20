IP Protocol resolve filter
---

Status : experimental plugin.

The filter is used to translate IP Protocol numbers to IP Protocol Names.

Example 1: resolve protocol name for field ``protocol``.
Config using url: ``filter://ipproto://protocol``

Config using logstash format:
````
filter {
  ipproto {
    field => protocol
  }
}
`````

Parameters:

* ``field``: which field to work on.
* ``target_field``: field to store the result. Default : source field.
