Tinymath filter
---

Status : core plugin, unit tested and maintained.

A tiny arithmetic expression evaluator with pluggable functions.

Example 1: multiply the value of field ``delay`` by 1000.
````
filter {
  tinymath {
    target_field => new_delay
    expression => "delay * 1000"
  }
}
`````

Example 2: add ``a`` character to the field ``toto``.
````
filter {
  eval {
    field => delay
    operation => "x + 'a'"
  }
}
`````
Parameters:

* ``expression``: tinymath expression. Can use optional function if defined.
* ``function``: javascript custom function for tinymath expression.
* ``target_field``: field to store the result.
