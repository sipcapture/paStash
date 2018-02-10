Json Schema filter
---

Status : core plugin, unit tested and maintained.

The json schema filter is used to parse and return safe JSON according to a predefined schema using [fast-json-stringify](https://github.com/fastify/fast-json-stringify)

JSON Schema File:
```
{
  title: 'Example Schema',
  type: 'object',
  properties: {
    nickname: {
      type: 'string'
    },
    undecidedType: {
      'anyOf': [{
	type: 'string'
      }, {
	type: 'boolean'
      }]
    }
  }
}
```


Example 1: will parse, as JSON, the given stream of messages which ``type`` matches ``json_stream``.
Config using url: ``filter://json_fields://?only_type=json_stream``

Config using logstash format:
````
filter {
  if [type] == 'json_stream' {
    json_fields {}
  }
}
```
