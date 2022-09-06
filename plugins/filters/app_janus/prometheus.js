const client = require('prom-client');
const Registry = client.Registry;
const registry = new Registry();
const {EventEmitter} = require('events')

const emitter = new EventEmitter()

setInterval(async () => {
    const metrics = await Promise.all(registry.getMetricsAsArray().map(descr => descr.get()));
    metrics.forEach(metric => {
        const streams = metric.values.map(value => ({
            stream: {
                ...Object.fromEntries(Object.entries(value.labels).map(e => [e[0], e[1].toString()])),
                __name__: value.metricName || metric.name
            },
            values: [[`${Date.now()}000000`, '', value.value]]
        }));
        emitter.emit('data', {streams: streams})
    });
    registry.resetMetrics();
}, 15000);

module.exports = {
    client,
    registry,
    emitter
}