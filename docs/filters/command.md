
# PaStash Command Filter
This is an  filter executing chain of commands .

Initialize the command filter and load any plugins. Point to the JSON field containing the data Array.


### Usage Example
for running this demo open new project and run :

```
npm install --save @voicenter/pastash @voicenter/voicenter_pastash_command_demo
``` 


open a test.conf file and add :
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
    plugins_path => "path_to_plugins" (if not set or plugin is not in directory will try to load from global)
    plugins => plugins.json
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

#### plugins.json example 
```

{
    "@voicenter/voicenter_pastash_command_demo": {"conf": "value"}
}

```


#### Pass it an Request with a Command array 
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
