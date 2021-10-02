## Matrix Output

### Install
```
npm install -g @pastash/pastash @pastash/output_matrix
```

### Example

```
input {
  stdin {}
}

output {
  matrix {
    userId => '@somebot:matrix.org'
    roomId => '#somechannel:matrix.org'
    token => 'xxxxxXXXXXxxxxxxXXXXXX'
  }
}
```
