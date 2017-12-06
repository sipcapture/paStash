CSV filter plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to parse CSV to JSON within a filter using the fast ```csv-parser```. 

Config using logstash format:
````
filter {
  csv {
    file_path => '/path/to/test.csv'
  }
}
````

Parameters :
* ``headers`` : Array with headers to parse CSV, ie: ```['name','age']```
* ``separator``: specify optional cell separator. Defaults to: ','.
* ``quote``: specify optional quote character.
* ``escape``: specify optional escape character (defaults to quote value).
* ``newline``: specify a newline character.
