## Matrix Input


### Install
```
npm install -g @pastash/pastash @pastash/input_matrix
```

### Example

```
input {
  matrix {
    userId => '@somebot:matrix.org'
    roomId => '#somechannel:matrix.org'
    token => 'xxxxxXXXXXxxxxxxXXXXXX'
  }
}


output {
  stdout {}
}
```
