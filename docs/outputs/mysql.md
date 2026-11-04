MySQL output plugin
---

Status : optional plugin.

Sends each event to MySQL. The default statement is a bound call:

```
call SP_UpdateSyncResult(?);
```

The driver binds `JSON.stringify` of the event as that parameter. The value is never concatenated into the SQL text.

`query` may still contain the historical `{|data|}` placeholder. The quoted form `'{|data|}'` and the bare form `{|data|}` are both rewritten to `?` before the statement runs. A `?` written directly in `query` is bound the same way. A `?` inside a SQL string literal is not a placeholder.

`multipleStatements` is off. Stacked statements in an event field are not executed.

Example:

````
output {
  mysql {
    db => mydb
    host => 127.0.0.1
    user => pastash
    password => secret
    query => "call SP_UpdateSyncResult(?);"
  }
}
````

Parameters:

* ``db``: database name. Default: ``database``.
* ``host``: server host. Default: ``127.0.0.1``.
* ``port``: server port. Default: ``3306``.
* ``user``: login. Default: ``root``.
* ``password``: password. Default: ``admin``.
* ``query``: statement to run. Default: ``call SP_UpdateSyncResult(?);``.
* ``interval_ms``: reserved. Default: ``10000``.
