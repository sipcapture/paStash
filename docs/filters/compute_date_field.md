Compute date field filter
---

Status : core plugin, unit tested and maintained.

The compute date field filter is used to compute a date field from ``timestamp``field, using [moment](http://momentjs.com/docs/#/parsing/string-format/) date format.
Optionally, you can provide a from_field field if you want for example to convert an epoch time field to human readable time field.

Example 1: add a field named ``toto``, containing timestamp formated with ``DD/MMMM/YYYY``
Config using url: ``filter://compute_date_field://toto?date_format=DD/MMMM/YYYY``

Config using logstash format:

````
filter {
  compute_date_field {
    field => toto
    date_format => 'DD/MMMM/YYYY'
  }
}
````

Example 2: add a field named ``human_readable_time``, containing timestamp formated with mask ``YYYY-MM-DDTHH:mm:ss.SSSZ`` from ``epoch_time`` field

Config using logstash format:

````
filter {
  compute_date_field {
    from_field => epoch_time    
    field => human_readable_time
    date_format => 'YYYY-MM-DDTHH:mm:ss.SSSZ'
  }
}
````

Parameters:

* ``from_field`` (optional): which field to take the value from.
* ``field``: which field to put the value into.
* ``date_format``: date format string, using [moment](http://momentjs.com/docs/#/parsing/string-format/).
