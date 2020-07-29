var base_output = require('@pastash/pastash').base_output,
    logger = require('@pastash/pastash').logger,
    util = require('util');
var THIS ;
var pg = require('pg');
const { Pool, Client } = require('pg')

var pool = {};

const { uuid } = require('uuidv4');

function OutputPostgres() {
    base_output.BaseOutput.call(this);
    this.mergeConfig({
        name: 'postgres',
        optional_params: ['db', 'table', 'query', 'host', 'user', 'password', 'port', 'create_table', 'create_db', 'id'],
        default_values: {
            'db' : 'test',
            'table' : 'pastash',
            'host': '127.0.0.1',
            'port': 5432,
            'user': 'root',
            'password': 'admin',
            'id': 'id',
	    'create_db': false,
	    'create_table': false
        },
        start_hook: this.start,
    });
}
OutputPostgres.prototype.start =function(callback) {
    THIS =  this;
    if (this.db) {
        try {
	    var pgConnectionString = 'postgres://' + this.user + ':' + this.password + '@' + this.host + ":" + this.port + '/' + this.db;
            logger.info('Initializing Output Filter Postgres:',this.db);
		pool.client = new Client({
		  connectionString: pgConnectionString,
		})
		pool.client.on('error', err => { pool.client.end(); this.start(); }  );

		pool.client
		  .connect()
		  .then(() => console.log('DB connected!'))
		  .catch(err => logger.error('DB connection error!', err.stack))
		  .then(() => {
			  if (this.create_db){
				pool.client.query('CREATE DATABASE ' + this.db + ';',
			                function(err,result) {
			                    if (err) {
			                        logger.error("Error Creating Database!", err);
			                    }
					    if (this.debug) logger.info(result);
					}
			        );
			  }
			  if (this.create_table){
				pool.client.query('CREATE TABLE IF NOT EXISTS ' + this.table + '(id TEXT NOT NULL PRIMARY KEY, data JSONB NOT NULL);',
			                function(err,result) {
			                    if (err) {
			                        logger.error("Error Creating Table!", err);
			                    }
					    if (this.debug) logger.info(result);
					}
			        );
			  }
		  })

        } catch(e){ logger.error('Failed to Initialize Output Filter Postgres!',e); }
    }
    logger.info('Initialized Output Filter Postgres');
    callback();
}

var createDatabase = function(){

}

util.inherits(OutputPostgres, base_output.BaseOutput);

var insert_failures = 0;

OutputPostgres.prototype.process = function(data) {
	var id = uuid();
	if (data[this.id]) id = data[this.id];
	if (!pool && !pool.client) {
		logger.error("no pg client available", pool.err);
		return;
	}
	if(!this.table) {
		logger.error("no table configured?");
		return;
	}
	pool.client.query('insert into ' + this.table + '(id, data) values($1, $2)',
                [id, data],
                function(err,result) {
                    if (err) {
                        logger.error("error inserting!", err);
			insert_failures++;
			if(insert_failures > 10) {
				insert_failures = 0;
				logger.error("too many insert failures, restarting pool");
				pool.client.end(); this.start();
			}
                    }
		    if (this.debug) logger.info("Successful insert!",result);
		}
        );
};

OutputPostgres.prototype.close = function(callback) {
    logger.info('Closing Output Filter Postgres');
    pool.client.end();
    callback();
};

exports.create = function() {
    return new OutputPostgres();
};
