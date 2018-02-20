Oracle DB output plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to insert data to a remote Oracle DB database.

WARNING: The Oracle binary client should be installed upfront, see https://oracle.github.io/odpi/doc/installation.html#linux for help


Config using logstash format:
````
output {
  oracle {
    username => 'myuser'
    password => 'mypass'
    connectString => 'localhost/service'
    schema => [{column: 'uuid', default: 'null'},{column: 'callid', default: 'null'},{column: 'mos', default: 0}]
  }
}
````

Parameters :
* ``username``: username for authenticating access. Required.
* ``password``: password for authenticating access. Required.
* ``connectString``: connection string for OracleDB. Required.
* ``schema``: JSON Array with Mapping schema. Required.
