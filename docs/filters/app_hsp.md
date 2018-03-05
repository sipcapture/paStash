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
* ``splitter``: Split and Fork Custom Grouped CDRs (cstm1 through cstm5).
* ``omit``: Optional Keys to drop from returned object. Accepts string or array.
