<img src="http://i.imgur.com/wYjsCqz.png"/>

# paStash condiments
NPM Plugin Modules for Pastash NG (@pastash/pastash)


### Notes
* Only works with exports from `@pastash/pastash` 1.0.44 _and higher_
* Only works with plugins and commands published in the `@pastash` keyspace


### Usage
To use a plugin alongside `pastash` both should be installed globally:
```
npm install -g @pastash/pastash
npm install -g @pastash/input_dummy
```

Configuration functions not provided internally result in an npm lookup using a combination of `type` and `name`
##### Example
```
input {
  dummy {}
}
```
##### Lookup
`require("@pastash/input_dummy")`


