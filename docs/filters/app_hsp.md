App HSP filter
---

Status : functional, experimental plugin.

The HEPIC platform can export realtime metrics and CDRs using the HSP protocol. 
The filter is used to decode HSP bencode-style format and fields.

Example 1: parse HSP CDRs w/o field resolution.
````
filter {
  app_hsp {}
}
`````

Example 2: parse HSP CDRs w/ Pseudo Rate field resolution.
````
filter {
  app_hsp {
    default_cc => '31' 
    sqlite_db => '/usr/local/hspserver/etc/prefix_data.sqlite'
    strip_local => '^0[1-9]'
    strip_dialprefix => '^00'
    strip_testuser => '^5000'
  }
}

`````

Example 3: parse HSP CDRs w/ IP Group resolution.
````
filter {
  app_hsp {
    default_cc => '31' 
    sqlite_db => '/usr/local/hspserver/etc/prefix_data.sqlite'
    hepic_host => '127.0.0.1'
    hepic_port => '8087'
    hepic_path => '/api/v2/admin/groupip'
    groupby => 'source' // source, destination, sdpmedia
  }
}

`````

Parameters:

* ``default_cc``: default country code for pseudo-rating.
* ``sqlite_db``: default sqlite db for pseudo-rating.
* ``strip_local``: regex rule for local prefix matching.
* ``strip_dialprefix``: regex rule for international prefix matching.
* ``strip_testuser``: regex rule for test user matching.
* ``hepic_host``: HEPIC API host. Default: 127.0.0.1.
* ``hepic_port``: HEPIC API port. Default: 8087.
* ``hepic_path``: HEPIC API path. Default: '/api/v2/admin/groupip'.
* ``hepic_token``: HEPIC API access token.
* ``groupby``: IP Grouping strategy (source|destination|sdpmedia).
* ``omit``: Optional Keys to drop from returned object. Accepts string or array.
* ``links``: In-Memory CDR Correlation pipeline (false|true).
* ``links_size``: Max size of entries In-Memory CDR Correlation pipeline. Default: 5000.
* ``links_age``: Max age in ms for entries In-Memory CDR Correlation pipeline. Default: 5000.
* ``links_vectors``: Vectors for In-Memory CDR Correlation pipeline. Accepts full path to module file.

Default Vectors:
In-Memory correlation vectors extract a `key` with optional `regex` transforms, forking with `prefix`,`suffix` and stored in memory for pairing, assigning a `score` to each match against. Parameter `name` can be used to force the set for common fields, such as `correlation_id` and `callid` in most CDRs.

The following format is accepted by the [qrelate](https://github.com/QXIP/qrelate) `links_vectors` file pointer for importing rules:
```
module.exports = [
    { score: 100, key: 'callid', suffix: "_b2b-1" },
    { score: 100, key: 'correlation_id', name: 'callid' },
    { score: 100, key: 'x-cid', name: 'callid' },
    { score: 50,  key: 'ruri_user', regex: /^(00|\+)/ },
    { score: 50,  key: 'to_user', name: "to_user_tail", regex_match: /.{8}$/ }
    { score: 50,  key: 'anumber_ext' prefix: "USER-" }
];

```
