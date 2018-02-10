// Base Aggs, returns metric total and average per time interval

var _ = require("lodash");

// Contains portions from https://github.com/dsummersl/interval-logger
// Copyright (c) 2016, Dane Summers, ISC Licensed

/////////////////////////////////////////////////////////////////////////////////
//                                 CountLogger                                 //
/////////////////////////////////////////////////////////////////////////////////

// A class to return statistic buckets at regular intervals.
//
// Parameters:
//   metric     = Name of the main metric.
//   reportZeros = if true, report 0s otherwise don't.
//   intervalMS = How often to report the metric.
//   callback   = A 'report' callback. If not provided send to console.log. Called
//                with two parameters: the metric name and a dictionary of keys
//                to counts that were recorded.

function CountLogger(metric, reportZeros, intervalMS, callback) {
  'use strict';
  this.subkeys = {};
  this.subkeyData = {};
  this.metric = metric;
  this.reportZeros = reportZeros || true;
  this.callback = callback;
  var self = this;
  var resetFn = function() {
    self._send();
    _.forEach(_.keys(self.subkeys),function(v) {
      self.subkeys[v] = NaN;
    });
  };
  this.intervalId = setInterval(resetFn,intervalMS);
}

CountLogger.prototype.stopInterval = function() {
  'use strict';
  clearInterval(this.intervalId);
};

CountLogger.prototype._send = function() {
  'use strict';
  var dataToSend = _.cloneDeep(this.subkeys);
  if (this.reportZeros) {
    this.callback(this.metric, dataToSend);
    return;
  }
  dataToSend = _.omitBy(dataToSend, _.isNaN);
  if (_.keys(dataToSend).length === 0) {
    return;
  }
  this.callback(this.metric, dataToSend);
};

// Increment a counter.
//
// Parameters:
//   subkey = Appended to the main metric name (default "count").
//   count  = Amount to increment by (default 1).

CountLogger.prototype.increment = function(subkey,count) {
  'use strict';
  var addition = 1;
  var target = subkey;
  if (!subkey) {
    target = 'count';
  }
  if (isFinite(count)) {
    addition = count;
  }
  if (!_.has(this.subkeys,target) || _.isNaN(this.subkeys[target])) {
    this.subkeys[target] = 0;
  }
  this.subkeys[target] += addition;
};

// Set a value that should have statistics calculated on it (count, average, total)
//
// Useful for gauge like things (number of active requests at the moment, etc),
// rather than events (increment is better for that).
//
// Creates the following values based on the 'subkey':
//  subkey.count    = number of times this subkey was called in the interval
//                    (eg, number of numbers).
//  subkey.avg      = the average of the numbers in the interval.
//  subkey.sum      = the sum of the numbers in the interval.

CountLogger.prototype.statistics = function(subkey, value) {
  'use strict';
  if (!this.subkeys[subkey +'.count']) {
    this.subkeys[subkey +'.count'] = 0;
  }
  var n = ++this.subkeys[subkey +'.count'];
  var oldM, newM, oldT, newT;
  if (n === 1) {
    oldM = newM = value;
    oldT = newT = value;
  } else {
    oldM = this.subkeyData[subkey +'.M'];
    oldT = this.subkeyData[subkey +'.T'];
    newT = oldT + value;
    newM = oldM + (value - oldM)/n;
  }
  // next iteration
  this.subkeyData[subkey +'.M'] = oldM;
  this.subkeyData[subkey +'.T'] = oldT;

  this.subkeys[subkey +'.sum'] = newT;
  this.subkeys[subkey +'.avg'] = newM;

};

/////////////////////////////////////////////////////////////////////////////////
//                                  Factories                                  //
/////////////////////////////////////////////////////////////////////////////////

// Create a new aggregator.
//
// Parameters:
//   metric: The top level graphite key to store.
//   reporter: A 'report' callback. If not provided send to console.log. Called
//             with two parameters: the metric name and a dictionary of keys
//             that were sent to graphite.
//   intervalMS = Number of milliseconds between aggregations (in ms).
//   reportZeros = if true, report 0s otherwise don't.

function config() {
  return {
    optional_params: [
      'reporter',
      'intervalMS',
      'reportZeros'
    ],
    default_values: {
      'reporter': false,
      'intervalMS': 1000,
      'reportZeros': true
    },
    start_hook: function(callback) {
      this.create = function(metric,reporter) {
        'use strict';
        if (!reporter || !this.reporter) {
          this.reporter = function(metric, values) {
            return { metric: values };
          };
        }
        return new CountLogger(metric, this.reportZeros, this.intervalMS, reporter || this.reporter);
      };
      callback();
    },
  };
}

exports.config = config;
