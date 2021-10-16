<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Prometheus_software_logo.svg/1200px-Prometheus_software_logo.svg.png" width=200 />

## Prometheus Scraper Input
This plugin will scrape a Prometheus Metrics endpoint and emit individual metrics w/ tags

### Install
```
npm install -g @pastash/pastash @pastash/input_prom_scraper
```

### Example

```
input {
  prom_scraper {
    url => "http://demo.robustperception.io:9100/metrics"
  }
}


output {
  stdout {}
}
```
