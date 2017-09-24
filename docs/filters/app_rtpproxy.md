App RTPProxy Log filter
---

Status : functional, experimental plugin.

The vendor filter is used to extract IP:PORT stream to session correlation vectors from RTPProxy debug logs.

Example 1: parse debug logs.
````
filter {
  app_rtpproxy {}
}
`````

Parameters:

* none
