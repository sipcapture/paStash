App Audiocodes filter
---

Status : functional, experimental plugin.

<img src="https://www.audiocodes.com/media/7974/mediant-800-session-border-controller-sbc.png" width=300>

## AUDIOCODES Syslog
This example recipe parse, reassemble and convert Audiocodes SBC logs back into IP/SIP/HEP types, received as Syslog UDP/TCP and shipped back to a HEP Capture Server such as HOMER or HEPIC for use cases where encrypted communication is unavailable off-the-wire for monitoring and troubleshooting.

#### Dependencies
* Audiocodes Mediant SBC
  * 7.40A.500 _(or higher)_
  * 7.20A.260.012 _(or higher)_
  * 7.20A.256.511 _(or lower)_
* NodeJS 18.x+ and paStash need to be installed before execution


#### NPM
```
# sudo npm install --unsafe-perm -g @pastash/pastash @pastash/filter_app_audiocodes
```


## SBC Settings

![image](https://user-images.githubusercontent.com/1423657/105026528-eae8b400-5a4e-11eb-8924-8dd2a744174a.png)

_NOTE: Since UDP is the only transport, paStash should be deployed in close network proximity of the SBC!_

## PaStash Recipe

* `syslog` input on port `514`
* `audiocodes` filter to parse syslog events
* `hep` output to port `9060`

Save the following recipe to a readable location, ie: `/path/to/pastash_audiocodes.conf`

```
input {
  udp {
    host => 0.0.0.0
    port => 514
    type => syslog
  }
}

filter {
  app_audiocodes{
    version => '7.40A.100.114'
    debug => false
    autolocal => true
    ini => '/path/to/copy/of/audiocodes.ini'
  }
}

output {
  if [rcinfo] != 'undefined' {
        hep {
          host => '127.0.0.1'
          port => 9060
          hep_id => 2222
        }
  }
}
```


## Usage
```
pastash --config_file=/path/to/pastash_audiocodes.conf
```

To configure as a service, please follow [this guide](https://github.com/sipcapture/paStash/wiki/pastash-service#running-as-node-service)

#### Options
Parameters for `app_audiocodes`:

* `ini`: Audiocodes INI path. Supports extraction and replacement of Interface aliases to IP:PORT. Default: false
* `iniwatch`: Audiocodes INI watched. Reloads changes upon modifications. Default: false
* `autolocal`: Enable detection of Local SBC IP from logs. Default : false.
* `localip`: Replacement IP for missing SBC Aliases. Default : 127.0.0.1.
* `localport`: Replacement port for missing SBC Aliases. Default : 5060.
* `logs`: Enable emulation of HEP 100 logs. Default : false.
* `qos`: Enable emulation of HEP QoS logs. Default : true.
* `correlation_hdr`: SIP Header to use for correlation IDs. Default : false.
* `correlation_contact`: Auto-Extract correlation from Contact x-c. Default : false.
* `debug`: Enable debug logs. Default : false.
* `file_debug`: Enable debug using file input. (For development) Default : false.
* `version`: Syslog parser version. Supports `7.40A.500` _(or higher)_. Default: 7.20A.260.012

For full instructions consult the [plugin documentation](https://github.com/sipcapture/paStash/blob/next/plugins/filters/app_audiocodes/app_audiocodes.md)


------

#### Limitations / TODO
* [x] Correlate SID to Call-IDs for SIP, Logs, QoS events
* [x] Parse SIP messages split across different syslog events
* [x] Parse [Media Reports page 353](https://www.audiocodes.com/media/10312/ltrt-41548-mediant-software-sbc-users-manual-ver-66.pdf) to HEP RTP reports
* [x] Autodetect SBC IP:PORT _(experimental)_
* [x] Convert non SIP logs to HEP 100 _(correlation?)_
* [x] Parse SBC Interfaces and Aliases from Audiocodes INI config file.
* [ ] Use Timestamp from event tail _(is time UTC?)_

