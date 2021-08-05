# Dry PaStash Filter


[dry](https://github.com/jonschlinkert/dry) is a templating rendered supporting the [liquid syntax](https://shopify.github.io/liquid/basics/introduction/)


### Install
```
npm install -g @pastash/pastash @pastash/filter_dry
```

### Example

```
input {
  stdin {}
}

filter {
  dry {
    render => ''Hello, {{ name }}!'
  }
}

output {
  stdout {}
}
```

