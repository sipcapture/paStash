/* 
   PASTASH MySQL Filter
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var mysql = require('mysql2');
var sqdb;

function FilterMySql() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'MySql',
    optional_params: ['db', 'table', 'query', 'source_field', 'target_field', 'filter', 'host', 'user', 'password'],
    default_values: {
      	'host': 'localhost',
	'user': 'root',
	'password': '',
      	'target_field': 'mysql'
    },
    start_hook: this.start,
  });
}

util.inherits(FilterMySql, base_filter.BaseFilter);

FilterMySql.prototype.start = function(callback) {

  if (this.db) { 
	try {
	  var cfg = { database: this.db };
	  if(this.host) cfg.host = this.host;
	  if(this.user) cfg.user = this.user;
	  if(this.password) cfg.password = this.password;
	  sqdb = mysql.createConnection(cfg);
	  logger.info('Initializing Filter MySql:',this.db);
	} catch(e){ logger.error('Failed Initializing Filter MySql',e); }
  }
  logger.info('Initialized Filter MySql');
  callback();
};

FilterMySql.prototype.process = function(raw) {
   if (!sqdb||!this.query) return raw;
   if (!this.source_field && !this.filter) return raw;

   try {

	if ( !this.filter && this.source_field ){
		this.filter = raw[this.source_field];
	}

	logger.info('test query!',this.query,this.filter);
	if (this.db) {
		sqdb.query(this.query, this.filter, function(err, row, fields) {
			if (err||!row) this.emit('output', raw);
			else {
				raw[this.target_field] = row;
				this.emit('output', raw);
			}
		}.bind(this));	
	} else { return raw; }

   } catch(e) { logger.info('failed processing mysql!',e); return raw; }

};

FilterMySql.prototype.close = function(callback) {
  logger.info('Closing Filter MySql');
  callback();
};

exports.create = function() {
  return new FilterMySql();
};
