paStash
====
_"When logs give you spaghetti, make pasta"_

<img src="http://i.imgur.com/wYjsCqz.png"/>

[![Codefresh build status]( https://g.codefresh.io/api/badges/build?repoOwner=sipcapture&repoName=paStash&branch=master&pipelineName=paStash&accountName=lmangani&type=cf-1)]( https://hub.docker.com/r/qxip/pastash/)

What is paStash ?
---

PaStasH _(pastaʃ'ʃ-utta)_ is a [NodeJS](http://nodejs.org) multi I/O processor which supports ingestion, decoding, interpolation and correlation of data - be it logs, packets, events and beyond. PaStash supports the Logstash configuration format and delivers cross-functionality comparable to _"Beats"_ with custom modules, providing a flexible and agnostic data pipelining tool.


What can I do with paStash ?
---

paStash is designed to manage spaghetti I/O with input, processors and output modules for all seasons, and can be useful in many scenarios, such as parsing logs to objects, distributing data to multiple formats, inter-exchanging and correlating protocols and streams, while interpolating and manipulating data in transit. paStash is developed using NodeJS, which is an ideal language for applications with many IO, and offers:

* low memory footprint
* low CPU usage
* low start-up delay
* ease of extension

paStash configuration is compatible with logstash. You can easily replace a logstash node with a paStash one in most cases. The data are formatted in the same way so as to be compatible with logstash UIs.

How does it work?
===

The architecture is identical to logstash architecture. You instantiate plugins with the paStash core. There are three type of modules/plugins:

* [inputs plugins](#inputs): where log data comes into paStash. Examples: file, zeromq transport layer
* [filter plugins](#filters): extract and manipulate fields from logs, like timestamps. Example: regex plugin
* [outputs plugins](#outputs): where data leaves from paStash: Examples: ElasticSearch , zeromq transport layer.


A paStash deployment has agents to ingest logs (at source also), and optionally a paStash node for further processing.

On an agent, paStash is generally configured via input plugins to get logs from your software stack, and via one or more output plugins to send the logs to a paStash node (eg. via zeromq output plugin), or directly to ElasticSearch.

On the paStash node, logs come in via e.g. a zeromq input plugin, can be processed (fields and timestamps extraction), and sent onward to ElasticSearch.



How to use it ?
===

Installation
---
### NPM install
```
sudo npm install -g pastash
```

### Manual install

* Install NodeJS, version >= 8.xx
* Install build tools
  * Debian based system: `apt-get install build-essential`
  * Centos system: `yum install gcc gcc-c++ make`
* Install zmq dev libraries: This is required to build the [node zeromq module](https://github.com/JustinTulloss/zeromq.node).
  * Debian based system: `apt-get install libzmq1`. Under recent releases, this package is present in default repositories. On ubuntu lucid, use this [ppa](https://launchpad.net/~chris-lea/+archive/zeromq). On debian squeeze, use [backports](http://backports-master.debian.org/Instructions/).
  * Centos 6: First, add the zeromq repo : `curl https://download.opensuse.org/repositories/network:/messaging:/zeromq:/release-stable/CentOS_6/network:messaging:zeromq:release-stable.repo > /etc/yum.repos.d/zeromq-centos6.repo`. 
  Then `yum install zeromq zeromq-devel`. 
  * CentOS 7: First, add the zeromq repo : `curl https://download.opensuse.org/repositories/network:/messaging:/zeromq:/release-stable/CentOS_7/network:messaging:zeromq:release-stable.repo > /etc/yum.repos.d/zeromq-centos7.repo`.
  Then `yum install zeromq zeromq-devel`. 
* Clone repository: `git clone git://github.com/sipcapture/pastash.git && cd pastash`
* Install dependencies: `npm install`.

The executable is ``bin/pastash``

Configuration formats
---

There are two formats for configuration. The legacy format uses urls. The new one is identical to the [logstash config format](https://www.elastic.co/guide/en/logstash/current/configuration.html).

Note : multiple configuration files can be used in parallel with the ``--config_dir`` switch.


Configuration by logstash config files
---

Example for an input file
```
input {
  file {
    path => '/tmp/toto.log'
  }
}
```

You can use ``if`` to have an [event dependent configuration](https://www.elastic.co/guide/en/logstash/current/event-dependent-configuration.html). See [here for details](docs/common_params.md).
It is possible to specify a synonymous config via urls

* directly on the command line
* in a file (use the ``--config_file`` switch)
* in all files in a directory (use the ``--config_dir`` switch)

Note : the implementation is young, all bug reports are welcome.
Note : both formats can be mixed.

Command line params
---

* ``--log_level`` to change the log level (emergency, alert, critical, error, warning, notice, info, debug)
* ``--log_file`` to redirect log to a log file.
* ``--patterns_directories`` to add some directories (comma-separated ,), for loading config, for regex plugin and grok plugins. Grok pattern files must be located under a ``grok`` subdirectory for each specified directory.
* ``--db_file`` to specify the file to use as database for file inputs (see below)
* ``--http_max_sockets`` to specify the maximum amount of sockets of [http.globalAgent.maxSockets](http://nodejs.org/api/http.html#http_agent_maxsockets). Default to 100.
* ``--alarm_file`` to specify a file which will be created if paStash goes into alarm mode.

Examples
---

Config file for an agent:
```
input {
  file {
    path => "/var/log/nginx/access.log"
  }
}

output {
  zeromq {
    address => ["tcp://log_server:5555"]
  }
}
```

Config file for log server:
```
input {
  zeromq {
    address => ["tcp://0.0.0.0:5555"]
  }
}

filter {
  regex {
    pattern => http_combined
  }
}

output {
  elasticsearch {
    host => localhost
    port => 9200
  }
}
```
See our [wiki](https://github.com/sipcapture/paStash/wiki) for many more [examples](https://github.com/sipcapture/paStash/wiki)


Plugins list
===

Inputs
---

* [AMQP](docs/inputs/amqp.md)
* [Asterisk AMI](docs/inputs/ami.md)
* [Bencode](docs/inputs/bencode.md)
* [File](docs/inputs/file.md)
* [Freeswitch ESL](docs/inputs/esl.md)
* [Google app engine](docs/inputs/gae.md)
* [HTTP](docs/inputs/http.md)
* [MQTT](docs/inputs/mqtt.md)
* [NetFlow](docs/inputs/netflow.md)
* [Redis](docs/inputs/redis.md)
* [SQS](docs/inputs/sqs.md)
* [Syslog](docs/inputs/syslog.md)
* [TCP / TLS](docs/inputs/tcp_tls.md)
* [Websocket](docs/inputs/ws.md)
* [ZeroMQ](docs/inputs/zeromq.md)
* [sFlow](docs/inputs/sflow.md)

Common concepts / parameters :

* [Tags/fields](docs/inputs/tags_fields.md)
* [Unserializers](docs/inputs/unserializers.md)

Filters
---

* [Bunyan](docs/filters/bunyan.md)
* [Compute date field](docs/filters/compute_date_field.md)
* [Compute field](docs/filters/compute_field.md)
* [Compute hash](docs/filters/compute_hash.md)
* [Eval](docs/filters/eval.md)
* [Geoip](docs/filters/geoip.md)
* [Grep](docs/filters/grep.md)
* [Grok](docs/filters/grok.md)
* [HTTP Status Classifier](docs/filters/http_status_classifier.md)
* [IPProto](docs/filters/ipproto.md)
* [Json fields](docs/filters/json_fields.md)
* [LRU](docs/filters/lru.md)
* [Multiline](docs/filters/multiline.md)
* [Mustache](docs/filters/mustache.md)
* [Mutate Replace](docs/filters/mutate_replace.md)
* [Omit](docs/filters/omit.md)
* [Regex](docs/filters/regex.md)
* [Remove field when equal](docs/filters/remove_field_when_equal.md)
* [Rename](docs/filters/rename.md)
* [Reverse DNS](docs/filters/reverse_dns.md)
* [Split](docs/filters/split.md)
* [Truncate](docs/filters/truncate.md)


Common concepts / parameters :

* [Common parameters](docs/common_params.md)
* [Tags/fields](docs/filters/tags_fields.md)

Apps with embedded parsers :

* [Avaya SM logs](docs/filters/app_avaya.md)
* [HEPIC HSP cdrs](docs/filters/app_hsp.md)
* [Janus RTC events](docs/filters/app_janus.md)
* [Sonus SBC logs](docs/filters/app_sonus.md)


Outputs
---

* [AMQP](docs/outputs/amqp.md)
* [ElasticSearch](docs/outputs/elasticsearch.md)
* [File](docs/outputs/file.md)
* [Gelf](docs/outputs/gelf.md)
* [HEP](docs/outputs/hep.md)
* [HTTP Post](docs/outputs/http_post.md)
* [InfluxDb](docs/outputs/influxdb.md)
* [Kafka](docs/outputs/kafka.md)
* [Logio](docs/outputs/logio.md)
* [NSQ](docs/outputs/nsq.md)
* [Redis](docs/outputs/redis.md)
* [SQS](docs/outputs/sqs.md)
* [Splunk](docs/outputs/splunk.md)
* [Statsd](docs/outputs/statsd.md)
* [TCP / TLS](docs/outputs/tcp_tls.md)
* [Websocket](docs/outputs/ws.md)
* [ZeroMQ](docs/outputs/zeromq.md)

Common concepts / parameters :

* [Common parameters](docs/common_params.md)
* [Serializers](docs/outputs/serializers.md)


Adding your plugins
---

You can add easily add your plugins :

Manually :

* create a directory layout in the path of your choice : ``/var/my_plugins/inputs``, ``/var/my_plugins/outputs``, ``/var/my_plugins/filters``
* set the NODE_PATH variable to ``NODE_PATH=/var/my_plugins:/node_logstash_path/lib``
* add your plugins in ``inputs``, ``outputs`` or ``filters`` directory. In the plugin code, you can reference base plugins with ``var base_filter = require('lib/base_filter');``
* reference your plugin as usual.


With native packaging

The plugins must be deployed in ``/var/db/pastash/custom_plugins``. All subdirectories already exist. The NODE_PATH is already set.


Signals
---

* USR1: stopping or starting all input plugins. Can be used to close input when output targets are failing
* USR2: see below file output plugin


Misc
---

* [Elasticsearch mapping](docs/elastic_mapping.md)

License
===

paStash Copyright 2016 - 2018 QXIP BV

node-logstash Copyright 2012 - 2014 Bertrand Paquet

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.


----
#### Made by Humans
This Open-Source project is made possible by actual Humans without corporate sponsors, angels or patrons.<br>
If you use this software in production, please consider supporting its development with contributions or [donations](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=donation%40sipcapture%2eorg&lc=US&item_name=SIPCAPTURE&no_note=0&currency_code=EUR&bn=PP%2dDonationsBF%3abtn_donateCC_LG%2egif%3aNonHostedGuest)

[![Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=donation%40sipcapture%2eorg&lc=US&item_name=SIPCAPTURE&no_note=0&currency_code=EUR&bn=PP%2dDonationsBF%3abtn_donateCC_LG%2egif%3aNonHostedGuest) 
