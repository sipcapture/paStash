GundDB filter
---

Status : experimental plugin.

The GunDB filter(s) (```gun_write```, ```gun_read```) are designed for writing and reading properties 
for inline distributed pairing and injection of _"realtime"_ correlation vectors across different inputs, 
filters and events processed by a cluster of connected paStash intances.

Example 1: cache and correlate fields across different event types/fields

Config using logstash format:
````
filter{
 if [type] == 2 {
  gun_write{
    field => session_id
    source => event.opaque_id
  }
 }
 if [type] == 32 {
  gun_read{
     target_field => correlation
     field => session_id
     source => event.opaque_id
   }
 }
}
````

Parameters:

* ```gun_write```
  * ``field``: which GunDB field to save on.
  * ``source``: source field to extract data from.
* ```gun_read```
  * ``field``: which GunDB field to work on.
  * ``target_field``: target field to inject with returned GunDB value.
  * ``source``: GunDB source field to extract data from.
