Aggs filter
---

Status : core plugin, unit tested and maintained.

The omit filter is used to drop or pick keys from objects using either a blacklist or whitelist.

Example 1: aggregate counter

Create an Aggregation for field `count` every `5s`:
````
filter {
  aggs {
    name => mySeries
    field => count
    intervalMS => 5000
  }
}
````

Parameters:

* ``name``: Name of series.
* ``field``: Name of JSON field to extract value from.
* ``intervalMS``: Interval of Aggregation Bucket. Default: 1000.
* ``reportZeros``: Report NULL series. Default: false.
