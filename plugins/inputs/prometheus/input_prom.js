var base_input = require('@pastash/pastash').base_input,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

const prometheusScraper = require("@splunkdlt/prometheus-scraper");

function InputProm() {
  base_input.BaseInput.call(this);
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Prom',
    optional_params: ['url', 'interval', 'debug', 'meta', 'prefix'],
    default_values: {
      'url': false,
      'meta': false,
      'prefix': false,
      'interval': 5000,
      'debug': false
    },
    start_hook: this.start,
  });
}

util.inherits(InputProm, base_input.BaseInput);

InputProm.prototype.start = function(callback) {
  if (!this.url) { logger.info('Missing Endpoint!'); return; }
  logger.info('Start Prom Scraper...', this.url);
  try {
	this.scrape = async function(){
	    const scrapeResult = await prometheusScraper.scrapePrometheusMetrics({
	        url: this.url
	    });
	    if (scrapeResult.metrics){
              for (const Metrics of scrapeResult.metrics) {
                const labels = Metrics.labels.reduce((acc, it) => {
                  acc[it.name] = it.value;
                  return acc;
                }, { name: Metrics.name, metric: Metrics.type });
                this.emit('data', { labels: labels, value: parseFloat(Metrics.value)} );
              }
            }
	}.bind(this);

	this.runner =  setInterval(function() {
	    this.scrape();
	}.bind(this), this.interval);
	  
	callback();

  } catch(e) { logger.error(e); }
};

InputProm.prototype.close = function(callback) {
  logger.info('Closing Prometheus Scraper input', this.path);
   clearInterval(this.runner);
  callback();
};

exports.create = function() {
  return new InputProm();
};
