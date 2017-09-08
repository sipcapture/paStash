/* 
   PASTASH SQLITE Filter
*/

var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var sqlite3 = require('sqlite3');
var sqdb;

function FilterSqlite() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Sqlite',
    optional_params: ['db', 'table', 'query', 'source_field', 'target_field', 'filter'],
    default_values: {
      'target_field': 'sqlite'
    },
    start_hook: this.start,
  });
}

util.inherits(FilterSqlite, base_filter.BaseFilter);

FilterSqlite.prototype.start = function(callback) {

  if (this.db) { 
	try {
		sqdb = new sqlite3.cached.Database(this.db);
	  	logger.info('Initializing Filter Sqlite3:',this.db);
	} catch(e){ logger.error('Failed Initializing Filter Sqlite3',e); }
  }
  logger.info('Initialized Filter Sqlite3');
  callback();
};

FilterSqlite.prototype.process = function(raw) {
   if (!sqdb||!this.query) return raw;
   if (!this.source_field && !this.filter) return raw;

   try {

	if ( !this.filter && this.source_field ){
		this.filter = raw[this.source_field];
	}

	logger.info('test query!',this.query,this.filter);
	if (this.db) {
		sqdb.get(this.query, this.filter, function(err, row) {
			if (err||!row) this.emit('output', raw);
			else {
				raw[this.target_field] = row;
				this.emit('output', raw);
			}
		}.bind(this));	
	} else { return raw; }
   } catch(e) { logger.info('failed processing sqlite!',e); return raw; }

};

FilterSqlite.prototype.close = function(callback) {
  logger.info('Closing Filter Sqlite3');
  callback();
};

exports.create = function() {
  return new FilterSqlite();
};
