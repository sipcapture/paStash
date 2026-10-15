Installation notes (#146, #163)
---

## Node.js version

Use **Node.js 18 LTS or newer** (20+ recommended). Older Node versions are not tested
with current ``@pastash/pastash`` on ``next``.

Check:

```
node -version
```

## Global install

Native optional dependencies (e.g. ``oniguruma`` for grok, sqlite plugins) require
building as root:

```
sudo npm install --unsafe-perm -g @pastash/pastash
```

If npm runs builds as user ``nobody``, set ``npm config set user root`` before
``npm install -g`` on minimal images.

## Plugins

Install plugins separately from the ``@pastash/*`` namespace:

```
sudo npm install --unsafe-perm -g @pastash/output_loki @pastash/filter_app_audiocodes
```

## Debian / CentOS

* Ensure ``build-essential`` (Debian) or ``gcc-c++ make`` (CentOS) is installed for
  native module compilation.
* Prefer Node from [NodeSource](https://github.com/nodesource/distributions) or distribution
  packages **18+**, not end-of-life Node 10/12/14.

If install still fails, capture the **first** ``npm ERR!`` block (not only deprecation
warnings) and open an issue with OS, Node version, and command used.
