paStash
====
_"When logs give you spaghetti, make pasta"_

<img src="http://i.imgur.com/wYjsCqz.png"/>

[![Codefresh build status]( https://g.codefresh.io/api/badges/build?repoOwner=sipcapture&repoName=paStash&branch=master&pipelineName=paStash&accountName=lmangani&type=cf-1)]( https://hub.docker.com/r/qxip/pastash/)

What is paStash ?
---

PaStasH _(pastaʃ'ʃ-utta)_ is a [NodeJS](http://nodejs.org) multi I/O processor supporting ingestion, decoding, interpolation and correlation of data - be it logs, packets, events and beyond. PaStash supports the Logstash configuration format and delivers cross-functionality comparable to _"Beats"_ with custom modules, providing a flexible and agnostig data pipelining tool.


What can I do with paStash ?
---

paStash is designed manage spaghetti I/O with input, processors and output modules for all seasons, and can be useful in many scenarios, such as parsing logs to objects, distributing data to multiple formats, interexchanging and correlating protocols and streams, while interpolating and manipulating data intransit. paStash is developed using NodeJS, which is an ideal language for applications with many IO and offers:

* lower memory footprint
* lower cpu footprint
* faster startup delay
* ease of extension

paStash configuration is compatible with logstash. You can easily replace a logstash node by a paStash one in most cases. The data are formatted in the same way to be compatible with logstash UIs.

How does it work ?
===

The architecture is identical to logstash architecture. You have to instanciates plugins with the paStash core. There are three type of modules:

* [inputs plugins](#inputs): where datas come into paStash. Examples: file, zeromq transport layer
* [filter plugins](#filters): extract and manipulate fields from logs, like timestamps. Example: regex plugin
* [outputs plugins](#outputs): where datas leave from paStash: Examples: ElasticSearch , zeromq transport layer.


A typical paStash deployement contains agents to crawl logs and a log server.

On agent, paStash is configured whith inputs plugins to get logs from your software stack, and one output plugin to send logs to log server (eg. zeromq output plugin).

On log server, logs come trough a zeromq input plugin, are processed (fields and timestamps extraction), and send to ElasticSearch.



How to use it ?
===

Installation
---
### NPM install
PaStash and its dependencies can be easily installed with NPM _(provides `pastash` as command)_
```
sudo npm install -g @pastash/pastash
```

### NPM plugin install
PaStash can be extended with modules from the `@pastash` NPM keyspace
```
sudo npm install -g @pastash/output_loki
```


Configuration formats
---

There are two format for configuration. The legacy format use urls. The new one is identical to the [logstash config format](https://www.elastic.co/guide/en/logstash/current/configuration.html).

Note : multiple configuration files can be used in parallel with the ``--config_dir`` switch.


Configuration by logstash config files
---

Example for a simple logging pipeline:
```
input {
  file {
    path => '/tmp/toto.log'
  }
}

output {
  loki {
    host => localhost
    port => 3100
    path => "/api/prom/push"
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
* ``--alarm_file`` to specify a file which will be created if paStash goes in alarm mode.

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

* See [paStash plugins](https://github.com/lmangani/pastash_plugins) for plugins lists, examples and docs


License
===

paStash Copyright 2016 - 2018 QXIP BV

node-logstash Copyright 2012 - 2014 Bertrand Paquet

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.


----
#### Made by Humans
This Open-Source project is made possible by actual Humans without corporate sponsors, angels or patreons.<br>
If you use this software in production, please consider supporting its development with contributions or [donations](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=donation%40sipcapture%2eorg&lc=US&item_name=SIPCAPTURE&no_note=0&currency_code=EUR&bn=PP%2dDonationsBF%3abtn_donateCC_LG%2egif%3aNonHostedGuest)

[![Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=donation%40sipcapture%2eorg&lc=US&item_name=SIPCAPTURE&no_note=0&currency_code=EUR&bn=PP%2dDonationsBF%3abtn_donateCC_LG%2egif%3aNonHostedGuest) 
