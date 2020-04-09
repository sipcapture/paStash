Convert epoch time to human time field filter
---

Status : core plugin, unit tested and maintained.

The convert epoch time to human time field filter is used to convert a date field from epoch to human time, using using [moment](http://momentjs.com/docs/#/parsing/string-format/) date format.

Config using logstash format:

````
filter {
   convert_epoch_to_ts_date_field {
    field => 'cdr_start'
    date_format => 'YYYY-MM-DDTHH:mm:ss.SSSZ'
  }
}
````

Parameters:

* ``field``: which field to work on.
* ``date_format``: date format string, using [moment](http://momentjs.com/docs/#/parsing/string-format/).