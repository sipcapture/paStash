Tinymath filter
---

Status : core plugin, unit tested and maintained.

A tiny arithmetic expression evaluator with pluggable functions.

Example 1: multiply the value of field ``delay`` by 1000.
````
filter {
  tinymath {
    target_field => "new_delay"
    expression => "delay * 1000"
  }
}
`````

Example 2: multiply the value of field ``delay`` using a custom function.
````
filter {
  tinymath {
    target_field => "double_delay"
    expression => "mydouble(delay)"
    function => { mydouble: function(d){ return d*2; }}
  }
}
`````
Parameters:

* ``expression``: tinymath expression. Can use optional function if defined.
* ``function``: javascript custom function for tinymath expression. Must be object.
* ``target_field``: field to store the result.
