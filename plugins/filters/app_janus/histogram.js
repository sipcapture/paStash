const {EventEmitter} = require('events')

module.exports = class extends EventEmitter {
    /**
     *
     * @param classes {number[]}
     * @param metric {string}
     */
    constructor(classes, metric) {
        super();
        classes.sort((a,b) => a-b);
        this.metric = metric;
        this.classes = classes;
        this.streams = {};
        const self = this;
        setInterval(() => {
            Object.values(self.streams).forEach(stream => {
                const now = `${Date.now() * 1e6}`
                stream.buckets.forEach(b => b.values[0][0] = now)
                stream.buckets_strict.forEach(b => b.values[0][0] = now)
                stream.sum.values[0][0] = now
                stream.count.values[0][0] = now
                const res = {streams: [
                        ...stream.buckets,
                        ...stream.buckets_strict,
                        stream.count,
                        stream.sum
                    ]}
                self.emit('data', res);
            });
            self.streams = {};
        }, 15000);
    }

    /**
     *
     * @param tags {Object<string, string>}
     */
    get(tags) {
        const strTags = JSON.stringify(tags);
        if (this.streams[strTags]) {
            return this.streams[strTags];
        }
        const _classes = [...this.classes, '+Inf']
        this.streams[strTags] = {
            buckets: _classes.map(cls => ({
                stream: {...tags, __name__: this.metric + '_bucket', le: cls.toString()},
                values: [['0', '', 0]]})),
            buckets_strict: _classes.map((cls, i) => ({
                stream: {
                    ...tags,
                    __name__: this.metric + '_bucket_strict',
                    le: cls.toString(),
                    gt: i === 0 ? '0' : _classes[i-1].toString()
                },
                values: [['0', '', 0]]})),
            count: {stream: {...tags, __name__: this.metric + '_count'},
                values: [['0', '', 0]]},
            sum: {stream: {...tags, __name__: this.metric + '_sum'},
                values: [['0', '', 0]]}
        }
        return this.streams[strTags];
    }

    /**
     * @param tags {Object<string, string>}
     * @param val {number}
     */
    put(tags, val) {
        const stream = this.get(tags)
        stream.sum.values[0][2] += val;
        stream.count.values[0][2] ++;
        let i = 0;
        while (i < this.classes.length && val > this.classes[i]) {
            i++;
        }
        stream.buckets_strict[i].values[0][2]++;
        while (i < stream.buckets.length) {
            stream.buckets[i].values[0][2]++;
            i++
        }
    }
}
