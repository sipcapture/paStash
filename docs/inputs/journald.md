Journald input plugin
---

Status : stable

Reads log events from **systemd-journald** by streaming `journalctl` output as JSON
(one event per journal entry).

Requires `journalctl` on the host (typical on systemd Linux).

Config using logstash format:

```
input {
  journald {
    type => journal
    unit => kamailio.service
    priority => info
    since => "1 hour ago"
  }
}
```

Config using url: ``input://journald://?unit=kamailio.service&since=1%20hour%20ago``

Parameters:

* ``journalctl``: path to the ``journalctl`` binary. Default: ``journalctl``.
* ``follow``: follow the journal (``journalctl -f``). Default: ``true``.
* ``lines``: number of historical lines to read before follow (``-n``). Default: ``0``.
* ``unit``: systemd unit filter (``-u``).
* ``user_unit``: user unit filter (``--user-unit``).
* ``priority``: priority filter (``-p``), e.g. ``err``, ``warning``, ``info``.
* ``since`` / ``until``: time bounds (``--since`` / ``--until``).
* ``boot``: boot id or offset (``-b``).
* ``identifier``: syslog identifier (``-t``).
* ``match``: additional ``journalctl`` predicate (passed as a single argument).
* ``type``: optional ``type`` field on emitted events.
* ``merge_fields``: when true (default), copy journal JSON fields onto the event (``MESSAGE`` becomes ``message``).

Each event includes ``source => journald`` and journal metadata fields such as
``_HOSTNAME``, ``PRIORITY``, and ``__REALTIME_TIMESTAMP`` when ``merge_fields`` is enabled.
