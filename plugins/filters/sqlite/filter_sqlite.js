/* 
   PASTASH SQLITE Filter
*/

var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var sqlite3 = require('better-sqlite3');
var sqdb;

function FilterSqlite() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'sqlite',
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
		this.db = new sqlite3(this.db);
		this.db.pragma('cache_size = 0');
	  	logger.info('Initializing Filter Sqlite3:',this.db);
	} catch(e){ logger.error('Failed Initializing Filter Sqlite3',e); }
  }
  logger.info('Initialized Filter Sqlite3');
  callback();
};

FilterSqlite.prototype.process = function(raw) {
   if (!this.query) return raw;
   if (!this.source_field && !this.filter) return raw;
   try {

	this.filter = raw[this.source_field];
	if (this.db) {

		const row = this.db.prepare(this.query).get(this.filter);
			if (!row) this.emit('output', raw);
			else {
				raw[this.target_field] =  Object.values(row)[0];
				this.emit('output', raw);
			}

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
