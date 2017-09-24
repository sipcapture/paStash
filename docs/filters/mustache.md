Mustache filter
---

Status : core plugin, unit tested and maintained.

The Mustache filter is used to render a new field using a template and the provided data.

Config using logstash format:
````
filter {
  mustache {
    template => '{{host}} received {{value}}'
    target_field => 'mustache_string'
  }
}
`````

Parameters:

* ``template``: mustache template to apply. Default uses the full data object.
* ``target_field``: field to store the result. Default : source field.
