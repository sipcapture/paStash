# PaStash Command Filter
This is an experimental filter executing a pipeline of commands against an array of objects, emitting results.


### Usage Example
Initialize the command filter and load any plugins. Point to the JSON field containing the data Array.
```
input {
  stdin{
  }
  http {
    host => 127.0.0.1
    port => 8080
  }
}
filter {
  json_fields {}
  command {
    debug => true
    field => message
    plugins => ['@pastash/command_chain']
    fieldCommandList => "Command"
    fieldResultList => "Result"
    commandList => ["fooFunc","barFunc"]
  }
}
output {
  stdout{
  }
}

```
#### Pass it an Array
```
{
  "Type":"RequestDemo",
  "Command" :["fooFunc","barFunc"]
}
```

each plugin need to export plugin object with a main set of functions :
```
module.exports = function plugin() {
    // decorate class prototype
    this.main.fooFunc = function(next) {
        // calling next  this to allow chaining on this function
        next();
    }
    this.main.barFunc = function(next) { next() }
}
```
