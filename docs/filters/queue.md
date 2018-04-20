Queue filter
---

Status : core plugin, unit tested and maintained.

The queue filter is used to create a persistent queue between inputs and filters. Events in the queue will be processed in case of crashes or restarts.

Example 1: persist events

Config a queue using logstash format:
````
filter {
  queue {
    queue_file => '/tmp/myqueue.json'
    queue_name => 'my_queue'
  }
}
````


Parameters:

* ``queue_name``: Name of the queue.
* ``queue_file``: Full path to queue storage file. Default: ```/tmp/pqueue.json```
