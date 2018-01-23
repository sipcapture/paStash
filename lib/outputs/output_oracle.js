var base_output = require('../lib/base_output'),
  util = require('util'),
  logger = require('log4node');

var oracledb = require('oracledb');
var Logger;

function OutputOracle() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('json_logstash'));
  this.mergeConfig({
    name: 'Oracle',
    optional_params: ['username', 'password', 'connectString', 'table', 'debug', 'simulate', 'check_interval', 'fields_array', 'values_array'],
    default_values: {
	debug: false,
	simulate: false
    },
    start_hook: this.start,
  });
}

util.inherits(OutputOracle, base_output.BaseOutput);

OutputOracle.prototype.start = function(callback) {

  if(!this.fields_array||!this.values_array){ logger.error('Missing Fields/Values! Exiting...'); return; }
  if(!this.connectString||!this.username||!this.password||!this.table) { logger.error('Missing DB parameters! Exiting...'); return; }

  if(!this.simulate){
	  this.doconnect = function(cb) {
	    oracledb.getConnection(
	      {
	        user          : this.username,
	        password      : this.password,
	        connectString : this.connectString
	      },
		function(err, connection)
		  {
		    if (err) {
		      logger.error(err.message);
		      return;
		    }
		    logger.info('Oracle Connection was successful!');
		    this.connection = connection;
	    }.bind(this));
	  };
	  this.dorelease = function(conn) {
	    conn.close(function (err) {
	      if (err)
	        logger.error(err.message);
	    });
	  };
  }

  if (this.check_interval) {
    if (this.check_interval < 1000) this.check_interval = 1000;
    logger.info('Oracle Check timer every ' + this.check_interval + 'ms');
    this.check_interval_id = setInterval(function() {
      this.check();
    }.bind(this), this.check_interval);
  }
  this.on_alarm = false;
  this.error_count = 0;

  logger.info('Creating Oracle Output to', this.connectString);
  callback();
};

OutputOracle.prototype.check = function() {
  if (this.on_alarm) {
    if (this.threshold_down && this.error_count < this.threshold_down) {
      logger.warning('Oracle socket end of alarm', this.connectString);
      this.on_alarm = false;
      this.emit('alarm', false, this.connectString);
      this.error_count = 0;
    } else {
      logger.info('Oracle socket still in alarm : errors : ', this.error_count );
    }
  }
};

OutputOracle.prototype.process = function(data) {

	if (!data) return;
	if (data.message) data = data.message;

	var values, cols;
	var inserts = [];
	cols = this.columns.join(",");
	this.values_array.forEach(function(val,i){
		if(data[val]) {
			cols += ':'+val;
			if(values_array.length != i) cols += ", ";
			inserts.push(data[val]);
		} else {
			logger.error('Error! Missing Field in Source:',val);
			return;
		}
	});

	if (this.simulate) {
		// Debug Query
	        logger.info('INSERT',"INSERT INTO "+this.table+" USE ("+cols+") VALUES ("+values+")", inserts);
		return;
	} else {
		// Submit Query
	  	this.connection.execute(
	  	  "INSERT INTO "+this.table+" USE ("+cols+") VALUES ("+values+")",
	  	  inserts,  // 'bind array of values
	  	  function(err, result)
	  	  {
	  	    if (err) {
			logger.warning("Oracle Producer Error:", err);
			this.error_count++;
			if (this.error_count > this.threshold_down){
			  this.on_alarm = true;
			  this.emit('alarm', true, this.connectString);
			}
		      } else {
		        logger.debug("Rows inserted: " + result.rowsAffected);  // 1
		      }
		});
	}

};

OutputOracle.prototype.close = function(callback) {
  if (this.check_interval_id) {
    logger.info('Clearing Oracle Check timer. Exit error count:',this.error_count);
    clearInterval(this.check_interval_id);
  }
  logger.info('Closing Oracle Output to', this.connectString);
  if (!this.simulate) this.dorelease(this.connection);
  callback();
};

exports.create = function() {
  return new OutputOracle();
};
