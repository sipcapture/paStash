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
    optional_params: ['username', 'password', 'connectString', 'table', 'debug', 'simulate', 'check_interval', 'schema', 'schema_file'],
    default_values: {
	debug: false,
	simulate: false
    },
    start_hook: this.start,
  });
}

util.inherits(OutputOracle, base_output.BaseOutput);

OutputOracle.prototype.start = function(callback) {

  if(!this.schema_file && !this.schema){ logger.error('Missing Schema! Exiting...'); return; }
  if(!this.connectString||!this.username||!this.password||!this.table) { logger.error('Missing DB parameters! Exiting...'); return; }

  try {
	if (this.schema_file) { this.dbschema = require(this.schema_file); }
	else { this.dbschema = this.schema; }
  } catch(e) { logger.error(e); return; }

  if(!this.simulate){
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

	var values = [];
	var cols = [];
	var inserts = [];

	try {
		this.dbschema.forEach(function(row,i){
		  try {
			cols.push(row.col);
			values.push( ':' + row.field );
                        if(data[row.field]) {
				if(row.type) {
				  switch(row.type) {
				    case 'date':
				        data[row.field] = new Date( data[row.field] );
				        break;
				    case 'int':
				        data[row.field] = parseInt( data[row.field]);
				        break;
				    case 'string':
				        data[row.field] = data[row.field].toString();
				        break;
				  }
				}
                                inserts.push(data[row.field]);
                        } else {
                                inserts.push(row.default);
				logger.error('Default Insert! Missing Field in Source:',row.field);
			}
		  } catch(e) { logger.error(e); return; }
		});

		var qquery = "INSERT INTO "+this.table+" USE ("+cols.join(',')+") VALUES ("+values.join(',')+")";

		if (this.simulate) {
			// Debug Query
			if (this.debug) logger.info("SIMULATE INSERT: %s %s", qquery, inserts);
			return;
		} else {
			// Submit Query
			if (this.debug) logger.info("NEXT INSERT: %s %s", qquery, inserts);
		  	this.connection.execute(
		  	  qquery,
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
	} catch(e) { logger.error(e); return; }
};

OutputOracle.prototype.close = function(callback) {
  if (this.check_interval_id) {
    logger.info('Clearing Oracle Check timer. Exit error count:',this.error_count);
    clearInterval(this.check_interval_id);
  }
  logger.info('Closing Oracle Output to', this.connectString);
  if (!this.simulate) {
	    this.connection.close(function (err) {
	      if (err)
	        logger.error(err.message);
	    });
  }
  callback();
};

exports.create = function() {
  return new OutputOracle();
};
