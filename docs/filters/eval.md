Eval filter
---

Status : core plugin, unit tested and maintained.

The eval filter is used to process a field with javascript code.

Example 1: multiply the value of field ``delay`` by 1000.
Config using url: ``filter://eval://delay?operation=x*1000``

Config using logstash format:
````
filter {
  eval {
    source_field => message
    target_field => message
    operation => "x * 100"
  }
}
`````

Example 2: add ``a`` character to the field ``toto``.
Config using url: ``filter://eval://toto?operation=x+%22a%22``

Config using logstash format:
````
filter {
  eval {
    field => delay
    operation => "x + 'a'"
  }
}
`````
Parameters:

* ``source_field``: which field to work on.
* ``target_field``: field to store the result. Default : source field.
* ``operation``: javascript code to execute. The input field is in the ``x`` variable.
