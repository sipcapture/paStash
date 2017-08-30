paStash
====

<img src="http://i.imgur.com/wYjsCqz.png"/>

What is it ?
---

PaStasH _(pastaʃ'ʃ-utta)_ [NodeJS](http://nodejs.org) is a multi I/O processor supporting ingestion, decoding, interpolation and correlation of data - be it logs, packets, events and beyond. PaStash supports the Logstash configuration format and delivers cross-functionality comparable to _"Beats"_ with custom modules, providing a flexible and agnostig data pipelining tool.


What to do with paStash ?
---

paStash is a tool to manage spaghetti I/O with input, processors and output modules for all seasons and protocols.

* lower memory footprint
* lower cpu footprint
* faster startup delay

Moreover it's written in NodeJS, which is a perfect language for programs with many IO.

paStash and node-logstash configuration is compatible with logstash. You can replace a node-logstash node by a paStash one in most cases. The data are formatted in the same way to be compatible with logstash UIs.

How does it work ?
===

The architecture is identical to logstash architecture. You have to instanciates plugins with the node-logstash core. There are three type of modules:

* [inputs plugins](#inputs): where datas come into node-logstash. Examples: file, zeromq transport layer
* [filter plugins](#filters): extract fields from logs, like timestamps. Example: regex plugin
* [outputs plugins](#outputs): where datas leave from node-logstash: Examples: ElasticSearch , zeromq transport layer.


A typical node-logstash deployement contains agents to crawl logs and a log server.

On agent, node-logstash is configured whith inputs plugins to get logs from your software stack, and one output plugin to send logs to log server (eg. zeromq output plugin).

On log server, logs come trough a zeromq input plugin, are processed (fields and timestamps extraction), and send to ElasticSearch.



How to use it ?
===

Installation
---

### Manual install

* Install NodeJS, version >= 0.12
* Install build tools
  * Debian based system: `apt-get install build-essential`
  * Centos system: `yum install gcc gcc-c++ make`
* Install zmq dev libraries: This is required to build the [node zeromq module](https://github.com/JustinTulloss/zeromq.node).
  * Debian based system: `apt-get install libzmq1`. Under recent releases, this package is present in default repositories. On ubuntu lucid, use this [ppa](https://launchpad.net/~chris-lea/+archive/zeromq). On debian squeeze, use [backports](http://backports-master.debian.org/Instructions/).
  * Centos 6: `yum install zeromq zeromq-devel`. Before, you have to add the rpm zeromq repo : `curl http://download.opensuse.org/repositories/home:/fengshuo:/zeromq/CentOS_CentOS-6/home:fengshuo:zeromq.repo > /etc/yum.repos.d/zeromq.repo`
* Clone repository: `git clone git://github.com/sipcapture/pastash.git && cd pastash`
* Install dependencies: `npm install`.

The executable is ``bin/pastash``

Configuration formats
---

There are two format for configuration. The legacy format use urls. The new one is identical to the [logstash config format](https://www.elastic.co/guide/en/logstash/current/configuration.html).

Note : if you are using multiple config files, you can mix formats.

Configuration by url (legacy)
---

A plugin is instanciated by an url. Example: ``input://file:///tmp/toto.log``. This url
instanciate an input file plugin which monitor the file ``/tmp/toto.log``.

The urls can be specified:

* directly on the command line
* in a file (use the ``--config_file`` switch)
* in all files in a directory (use the ``--config_dir`` switch)

Configuration by logstash config files (recommended)
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
As for urls, config can be specified

* directly on the command line
* in a file (use the ``--config_file`` switch)
* in all files in a directory (use the ``--config_dir`` switch)

Note : the implementation is young, all bugs reports are welcome.
Note : both formats can be mixed.

Command lines params
---

* ``--log_level`` to change the log level (emergency, alert, critical, error, warning, notice, info, debug)
* ``--log_file`` to redirect log to a log file.
* ``--patterns_directories`` to add some directories (separated by ,), for loading config for regex plugin and grok plugins. Grok patterns files must be located under a ``grok`` subdirectory for each specified directory.
* ``--db_file`` to specify the file to use as database for file inputs (see below)
* ``--http_max_sockets`` to specify the max sockets of [http.globalAgent.maxSockets](http://nodejs.org/api/http.html#http_agent_maxsockets). Default to 100.
* ``--alarm_file`` to specify a file which will be created if node-logstash goes in alarm mode.

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

Adding your plugins
---

You can add easily add your plugins :

Manually :

* create a directory layout on the path of your choice : ``/var/my_plugins/inputs``, ``/var/my_plugins/outputs``, ``/var/my_plugins/filters``
* set the NODE_PATH variable to ``NODE_PATH=/var/my_plugins:/node_logstash_path/lib``
* add your plugins in ``inputs``, ``outputs`` or ``filters`` directory. In the plugin code, you can reference base plugins with ``var base_filter = require('lib/base_filter');``
* reference your plugin as usual.


With native packaging

The plugins must be deployed in ``/var/db/node-logstash/custom_plugins``. All subdirectories already exists. The NODE_PATH is already set.


Signals
---

* USR1: stoping or starting all inputs plugins. Can be used to close input when output targer are failing
* USR2: see below file output plugin

Changelog
===

[Changelog](changelog.md)

Plugins list
===

Inputs
---

* [File](docs/inputs/file.md)
* [Syslog](docs/inputs/syslog.md)
* [ZeroMQ](docs/inputs/zeromq.md)
* [Redis](docs/inputs/redis.md)
* [HTTP](docs/inputs/http.md)
* [Websocket](docs/inputs/ws.md)
* [TCP / TLS](docs/inputs/tcp_tls.md)
* [Google app engine](docs/inputs/gae.md)
* [AMQP](docs/inputs/amqp.md)
* [MQTT](docs/inputs/mqtt.md)
* [SQS](docs/inputs/sqs.md)
* [NetFlow](docs/inputs/netflow.md)
* [sFlow](docs/inputs/sflow.md)
* [Bencode](docs/inputs/bencode.md)
* [Freeswitch ESL](docs/inputs/esl.md)
* [Asterisk AMI](docs/inputs/ami.md)


Common concepts / parameters :

* [Unserializers](docs/inputs/unserializers.md)
* [Tags/fields](docs/inputs/tags_fields.md)

Filters
---

* [Regex](docs/filters/regex.md)
* [Grok](docs/filters/grok.md)
* [Mutate Replace](docs/filters/mutate_replace.md)
* [Grep](docs/filters/grep.md)
* [Reverse DNS](docs/filters/reverse_dns.md)
* [Compute field](docs/filters/compute_field.md)
* [Compute hash](docs/filters/compute_hash.md)
* [Compute date field](docs/filters/compute_date_field.md)
* [Split](docs/filters/split.md)
* [Truncate](docs/filters/truncate.md)
* [Rename](docs/filters/rename.md)
* [Multiline](docs/filters/multiline.md)
* [Json fields](docs/filters/json_fields.md)
* [Geoip](docs/filters/geoip.md)
* [Eval](docs/filters/eval.md)
* [Bunyan](docs/filters/bunyan.md)
* [IPProto](docs/filters/ipproto.md)
* [HTTP Status Classifier](docs/filters/http_status_classifier.md)
* [Remove field when equal](docs/filters/remove_field_when_equal.md)

Common concepts / parameters :

* [Common parameters](docs/common_params.md)
* [Tags/fields](docs/filters/tags_fields.md)

Apps with embedded parsers :

* [Avaya SM logs](docs/filters/app_avaya.md)
* [Sonus SBC logs](docs/filters/app_sonus.md)
* [Janus RTC events](docs/filters/app_janus.md)


Outputs
---

* [ZeroMQ](docs/outputs/zeromq.md)
* [ElasticSearch](docs/outputs/elasticsearch.md)
* [Statsd](docs/outputs/statsd.md)
* [Gelf](docs/outputs/gelf.md)
* [File](docs/outputs/file.md)
* [HTTP Post](docs/outputs/http_post.md)
* [Websocket](docs/outputs/ws.md)
* [Redis](docs/outputs/redis.md)
* [Logio](docs/outputs/logio.md)
* [TCP / TLS](docs/outputs/tcp_tls.md)
* [AMQP](docs/outputs/amqp.md)
* [SQS](docs/outputs/sqs.md)
* [HEP](docs/outputs/hep.md)

Common concepts / parameters :

* [Common parameters](docs/common_params.md)
* [Serializers](docs/outputs/serializers.md)


Misc
---

* [Elasticsearch mapping](docs/elastic_mapping.md)

License
===

Copyright 2016 - 2017 QXIP BV

Copyright 2012 - 2014 Bertrand Paquet

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
