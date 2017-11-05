var base_output = require('../lib/base_output'),
  util = require('util'),
  logger = require('log4node');

// Schema Validator
var Ajv = require('ajv');
var ajv = new Ajv();
// ClickHouse Client
var ClickHouse = require('clickhouse');
// Event Queue
var Queue = require('buffered-queue');
// Object Spoon
var Obj2Val = function(data,key){
	var keys = Object.keys( data );
	var out = new Array( this.keys.length );
	for ( i = 0; i < this.keys.length; i++ ) {
		out[ i ] = data[ this.keys[i] ];
	}
	if (!key) return out;
	else return keys;
}

function OutputClickHouse() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('json_logstash'));
  this.mergeConfig({
    name: 'ClickHouse',
    optional_params: ['url', 'port', 'debug','table', 'autoschema', 'name', 'q_size','q_timer','create_table', 'schema' ],
    default_values: {
	debug: false,
	url: 'http://localhost',
	port: 8123,
	name: 'pastash',
	q_size: 100,
	q_timer: 4000
    },
    start_hook: this.start,
  });
}

util.inherits(OutputClickHouse, base_output.BaseOutput);

OutputClickHouse.prototype.start = function(callback) {

  if(!this.host) return;
  // Initialize ClickHouse
  this.clickhouse = new ClickHouse({
	url   : this.host,
	port  : this.port,
	debug : this.debug
  });
  // Initialize Queue
  this.q = new Queue(this.name, {
    size: this.q_size,
    flushTimeout: this.q_timer,
    verbose: false
  });
  // Queue Processing
  this.q.on('flush', function(data,name){
    this.clickhouse.insertMany(this.name,data,function(err,result){
	if (err) { logger.error(err); return; }
	if (this.debug) logger.info(result);
    });
  }.bind(this);
  // Initialize Keys and Schema
  this.init = true;

  logger.info('Creating ClickHouse Output to', this.host,this.port);
  callback();
};

OutputClickHouse.prototype.process = function(data) {

	if (schema && !ajv.validate(schema, data)) { logger.error('Pass, Failed Schema'); returnl }
	if (this.debug) console.log("Queuing data to ClickHouse",data );
	if (this.init){
		// Initialize Schema Keys
		this.keys = Obj2Val( data, true );
		if (this.create_table) {
			this.clickhouse(this.create_table, function (err) {
				if (!err) logger.error(err);
			});
		}
		this.init = false;
	}
	// convert object to value array
	try {
		this.q.push(Obj2Val(data));
	} catch(e) {
		logger.error(e);
	}
	return;
};

OutputClickHouse.prototype.close = function(callback) {
  logger.info('Closing ClickHouse output to', this.host, this.port);
  callback();
};

exports.create = function() {
  return new OutputClickHouse();
};
