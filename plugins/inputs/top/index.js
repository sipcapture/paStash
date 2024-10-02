const base_input = require('@pastash/pastash').base_input
const spawn = require('child_process').spawn
const fs = require('fs')
const logger = require('@pastash/pastash').logger
const events = require('events')

class Top extends base_input.BaseInput {
    constructor() {
        super()
        this.mergeConfig(this.unserializer_config())
        this.mergeConfig({
            name: 'top',
            optional_params: ['pids', 'pidfiles', 'ps'],
            default_values: {
                'use_tail': false,
            },
            start_hook: this.start,
        })
        this.top = new TopSpawner()
        const self = this
        this.top.on('data', d => self.emit('data', d))
    }
    start(callback) {
        if (this.pids) {
            this.ps = Array.isArray(this.pids) ? this.pids : [this.pids]
            this.startPids(this.pids)
        }
        if (this.pidfiles) {
            this.ps = Array.isArray(this.pidfiles) ? this.pidfiles : [this.pidfiles]
            this.startPidfiles(this.pidfiles)
        }
        if (this.ps) {
            this.ps = Array.isArray(this.ps) ? this.ps : [this.ps]
            this.startPsAux(this.ps)
        }
        callback()
    }

    close(callback) {
        this.top.stop()
        this.pidfilesInterval && clearInterval(this.pidfilesInterval)
        this.psAuxInterval && clearInterval(this.psAuxInterval)
        callback()
    }

    /**
     *
     * @param {[string]} pids
     */
    startPids(pids) {
        let iPids = pids.map(parseInt).filter(s => s && !isNaN(s))
        this.top.setPids(iPids)
        logger.info(`set pids ${pids.join(', ')}`)
    }

    /**
     *
     * @param pidfiles {[string]}
     */
    startPidfiles(pidfiles) {
        if (!this.pidfilesInterval) {
            const self = this
            this.pidfilesInterval = setInterval(() => {
                const pids = self.pidfiles
                    .filter(fs.existsSync)
                    .map(fs.readFileSync)
                    .map(s => s.toString().trim())
                    .map(parseInt)
                    .filter(s => s || !isNaN(s))
                self.top.setPids(pids)
            }, 1000)
        }
        this.pidfiles = pidfiles
    }

    /**
     *
     * @param names {[string]}
     */
    startPsAux(names) {
        if (!this.psAuxInterval) {
            const self=this
            this.psAuxInterval = setInterval(async() => {
                const psaux = spawn(`ps aux`, {shell: true})
                let out = ''
                psaux.stdout.on('data', (data) => {
                    out += data.toString()
                })
                await new Promise(f => {
                    psaux.on('close', f)
                    psaux.on('exit', f)
                })
                const pids = out
                    .split('\n')
                    .map(p => p.trim().match(/^\S+\s+(?<pid>\S+\s+)(\S+\s+){0,8}(?<name>.+)$/, 10))
                    .filter(p => p && p.groups['name'] && self.names.some(n => p.groups['name'].match(new RegExp(n))))
                    .map(p => parseInt(p[1]))
                    .filter(p => p || !isNaN(p))
                self.top.setPids(pids)
            }, 1000)
        }
        this.names = names
    }
}

module.exports.create = function () {
    return new Top();
};

class TopSpawner extends events.EventEmitter {
    constructor() {
        super()
        this.top = null
        this.pids = {}
    }

    getPids() {
        let res = [...Object.keys(this.pids)]
        res.sort()
        return res
    }

    _putPids(pids) {
        for (const pid of pids) {
            this.pids[pid] = true
        }
    }

    /**
     *
     * @param pids {[number]}
     */
    setPids(pids) {
        const before = this.getPids()
        this._putPids(pids)
        if (JSON.stringify(this.getPids()) !== JSON.stringify(before)) {
            logger.info(`put new pids: ${pids.join(', ')}`)
            this.restart()
        }
    }
    restart() {
        if (!this.getPids() || !this.getPids().length) {
            return
        }
        if (this.top) {
            this.top.stdout.removeAllListeners('data')
            this.top.kill(9)
        }
        const self = this
        if (this.working) {
            return
        }
        this.working = true
        setTimeout(async () => {
            while(self.working) {
                try {
                    self.top = spawn(`stdbuf -oL top -bn 50 -w 512 -c`, {
                        shell: true
                    })
                    let buf = ''
                    self.top.stdout.on('data', (data) => {
                        const lines = (buf + data.toString()).split('\n')
                        buf = lines.pop()
                        for (const line of lines) {
                            const metrics = self.parseTopStr(line)
                            for (const metric of metrics) {
                                self.emit('data', metric)
                            }
                        }
                    })
                    await new Promise(f => {
                        self.top.once('close', f)
                        self.top.once('exit', f)
                    })
                    self.top.removeAllListeners('close')
                    self.top.removeAllListeners('exit')
                } catch (e) {
                    logger.error(e)
                    await new Promise(f => setTimeout(f, 500))
                }
            }
        })
    }

    /**
     *
     * @param str {string}
     */
    parseTopStr(str) {
        const res = []
        const m = str.match(/^\s*(?<pid>[0-9]+)\s+(\S+\s+){3}(?<virt>\S+\s+)(?<res>\S+\s+)(?<shr>\S+\s+)(\S+\s+)(?<cpu>[0-9.]+\s+)(\S+\s+){2}(?<cmd>.+)$/)
        if (!m || !this.pids[m.groups.pid]) {
            return res
        }
        const tags = {
            pid: m.groups.pid,
            cmd: m.groups.cmd
        }
        for (const metric of ['virt', 'res', 'shr']) {
            res.push({
                ...tags,
                "__name__": metric,
                "@value": this.parseMemory(m.groups[metric]) / 1024,
                "@timestamp": new Date().toISOString()
            })
        }
        res.push({
            ...tags,
            "__name__": 'cpu',
            "@value": parseFloat(m.groups.cpu),
            "@timestamp": new Date().toISOString()
        })
        return res
    }

    /**
     *
     * @param str {string}
     */
    parseMemory(str) {
        const m = str.match(/(?<num>[0-9.]+)(?<unit>[mgt])?/)
        const size = parseFloat(m.groups.num)
        switch (m.groups.unit) {
            case 'm':
                return size * 1024
            case 'g':
                return size * 1024 * 1024
            case 't':
                return size * 1024 * 1024 * 1024
            default:
                return size
        }
    }
    stop() {
        this.working = false
        this.top && this.top.stdout.removeAllListeners('data')
        this.top && this.top.kill(9)
        this.removeAllListeners('data')
    }
}
