## Random Input

### Install
```
npm install -g @pastash/pastash @pastash/input_random
```

### Example

```
input {
  random {
    type => json
    every => 10
  }
}


output {
  stdout {}
}
```
