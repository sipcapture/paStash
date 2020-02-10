Oracle DB output plugin
---
 Status : experimental plugin, unit tested and maintained.
 This plugin is used to insert data to a remote Oracle DB database.
 ##### WARNING: The Oracle binary client should be installed upfront, see https://oracle.github.io/odpi/doc/installation.html
 Config using logstash format:
````
output {
  oracle {
    username => 'myuser'
    password => 'mypass'
    connectString => 'localhost/service'
    table => 'test_table'
    schema_file => '/path/to/myschema.json'
  }
}
````
 Parameters :
* ``connectString``: connection string for OracleDB. Required.
* ``username``: username for authenticating access. Required.
* ``password``: password for authenticating access. Required.
* ``table``: OracleDB table name used for writing. Required.
* ``schema_file``: Absolute path to export module w/ Schema. Required.
* ``debug``: emit debug logs when true. Default: `false`.
* ``simulate``: simulate without connecting to OracleDB. Default: `false`.
 #### Example Schema
Schemas are provided as Node modules, exporting an array. When a value is not present, the `default` will be used in order to deliver consistent columns:
```
module.exports = [
{ "col":"CID", "field":"cid", "default":""},
{ "col":"GID", "field":"gid", "default":""},
{ "col":"UUID", "field":"uuid", "default":""}
{ "col":"TIMESTAMP", "field":"timestamp", "default":"0", "type": "date" }
];
```
