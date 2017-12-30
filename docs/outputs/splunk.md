Splunk output plugin
---

Status : experimental plugin, unit tested and maintained.

This plugin is used to send logs to Splunk.

## Requirements 
* Splunk Enterprise 6.3.0 or later, or Splunk Cloud.
* An HTTP Event Collector token from your Splunk Enterprise server.

Config using logstash format:
````
output {
  splunk {
    token => "your-token-here"
    splunk_url => "https://input-xxx.cloud.splunk.com:8088/services/collector/event"
    batchInterval => 1000
    maxBatchCount => 10
    maxBatchSize => 1024
  }
}
````

Parameters :
* ``splunk_url``: the Splunk Enterprise/Cloud url.
* ``token``: your Splunk access token. Required.
* ``batchInterval``: queue Batch interval. Optional.
* ``maxBatchCount``: queue max Batch count. Optional.
* ``maxBatchSize``: queue max Batch size. Optional
* ``index``: metadata info with target index. Optional
* ``sourcetype``: metadata info with source type. Optional
* ``source``: metadata info with source name. Optional
* ``host``: metadata info with host name. Optional
* ``timefield``: set metadata timestamp from data field. Optional.
* ``flat``:  send flat metadata + event to splunk. Optional.
* ``threshold_down``: threshold for send errors alerts. Default 10.
* ``check_interval``: check interval in ms for send errors alerts. Default false.
* ``debug``: print output splunk and API response messages to console. Optional.
