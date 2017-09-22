CSV input plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to parse CSV from an input file using the fast ```csv-parser```. 

Config using url: ``input://csv://?file_path=/path/to/test.csv``

Config using logstash format:
````
input {
  csv {
    file_path => '/path/to/test.csv'
  }
}
````

Parameters :
* ``file_path``: the input CSV File name and path. Required.
* ``separator``: specify optional cell separator. Defaults to: ','.
* ``quote``: specify optional quote character.
* ``escape``: specify optional escape character (defaults to quote value).
* ``newline``: specify a newline character.
