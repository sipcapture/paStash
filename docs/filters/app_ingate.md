App Ingate SBC SysLog filter
---

Status : functional plugin.

The filter is used to parse/reassemble Ingate SBC syslogs to complete HEP-SIP payloads. Currently works best with multi-line input. Only SIP: no RTCP is mirrored here, since it is not explicitly logged.

Intended for Ingate firmware <= 6.3. Firmware >= 6.3 have HEP mirroring. Note that it is possible to use this with later firmwares, but because >= 6.3 include HEP mirroring, this functionality is less convenient.

===

Important notes: 
In firmware <= 6.2.2, there exists a not so a subtle bug whereby occasional packet rows are lost: SIP packet rows which existed at in/egress are simply are absent from the relayed syslog.

This can be verified by doing a packet capture on the Ingate while forwarding syslog. Once in a while, the bug manifests: It will be evident when heplify-server tries to validate the HEP/SIP packet which this plugin sends. Some missing headers make invalid packets. Fortunately it is not so frequent. 

A more subtle bug in firmware <= 6.2.2: a buffer used for sending syslog rows seems to be limited to 256 bytes. SIP rows exceeding this length are truncated in the relayed syslog. 

Firmwares >= 6.3 changed the internal syslog custom component to rsyslog instead, which resolves these bugs. You are recommended to upgrade your firmware to at least 6.3 (and perhaps use the HEP mirroring facility there instead). 

So if you cannot upgrade to >= v6.3, then this plugin is the next best thing. 

===

Configure the ingate plugin with `debug => true` if you want to verify receipt of syslog messages from an Ingate, and print other stages of the syslog handling to the console.

This plugin could be improved with a small FSM to determine SIP message start and end.

Send your syslog through the multiline plugin first with e.g.

````javascript
    #re-assemble individual syslog rows into blocks
    multiline {
     #set start filter to match ingate send/recv
     start_line_regex => /^.*Info:\ssipfw:\s((send|recv).*)/
     max_delay => 10
     regex_flags => i
    }
````

Otherwise this plugin will only send individual syslog rows to the HEP system.


Example 1: parse syslogs.
````javascript
filter {
  app_ingate {}
}
`````

Example 2: parse syslogs and extract ``correlation_hdr`` for HEP pairing. 

Fun fact: Ingate does not have a correlation header: it internally correlates call legs which traverse the b2bua. The best way is to use the `Call-ID` header - and let Homer/heplify correlate. The algorithm there goes something like: leg A ID: `asdf1234`; after the b2b, it gets tagged with `@sipgt...` resulting in leg B ID: `asdf1234@sipgt...`. It is best to get the `...@sipgt...` ID, and truncate the domain portion to find the friends. 

In v6.3, this is what the HEP module does: truncate the domain portion from the `Call-ID` header and fill the `Correlation ID` field with it. So a default correlation profile works, there. RTCP is also mirrored via the HEP module. 

This is the internal default:
````javascript
filter {
  app_ingate {
    correlation_hdr => "Call-ID"
  }
}
`````

Correlation scripts in Homer for SIP could be something like e.g.:
```javascript
    {
        "source_field": "data_header.callid",
        "lookup_id": 1,
        "lookup_profile": "call",
        "lookup_field": "data_header->>'callid'",
        "lookup_range": [
            -300,
            200
        ],
        "input_function_js": "var returnData=[]; for (var i = 0; i < data.length; i++) { returnData.push(data[i].split('@')[0] ); }; returnData;"
    }
```

Example 3: because you probably need a few other modules to get everything running:

````
input {
  udp {
    host => 0.0.0.0
    port => 514
    type => syslog
    }
}

filter {
  #recipe for ingate (version < 6.3.0) syslog to SIP packet re-assembly
  #parse the syslog lines received via UDP at input above
  if [type] == syslog {
    regex {
      builtin_regex => syslogingate_all
    }
    syslog_pri {}

    #re-assemble individual syslog rows into blocks
    multiline {
     #set start filter to match ingate send/recv
     start_line_regex => /^.*Info:\ssipfw:\s((send|recv).*)/
     max_delay => 10
     regex_flags => i
    }

    #Ingate app to parse Syslog blocks -> SIP -> EEP
    app_ingate {}
  }
}

output {
# uncomment the next line to observe your results
# stdout {}
 hep {
    host => heplify-server
    port => 9060
    hep_id => 2001
    hep_type => 100
 }
}
````


Parameters:

* ``correlation_hdr``: SIP Header to use for correlation IDs. Default : ``'(?:[Cc]all-[Ii][Dd]\:|i\:)'``.
i.e. ``Call-ID:``, ``Call-Id:``, or the short header form, ``i:``.
* ``debug``: Set to true to print extra debug info to the console. Default: ``false``.

