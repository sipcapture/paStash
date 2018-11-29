/* PMX/PM2/io Stats */
 var exports = module.exports = {};
 try {
  const io = require('@pm2/io');
  exports.io = io;
} catch(e) {
  logger.info('No pm2/io available!', e);
  exports.io = false;
}
 /*
 const Realtime_Value = io.metric({
  name: 'Realtime Value'
});
 Realtime_Value.set(23);
 ---------------
 const reqsec = io.meter({
  name: 'req/sec',
  type: 'meter',
});
 http.createServer((req, res) => {
  reqsec.mark();
  res.end({ success: true });
});
 ---------------
 const latency = io.histogram({
  name: 'latency',
  measurement: 'mean'
});
 const latencyValue = 0;
 setInterval(() => {
  latencyValue = Math.round(Math.random() * 100);
  latency.update(latencyValue);
}, 100);
 */
