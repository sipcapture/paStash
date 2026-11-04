var base_output = require('@pastash/pastash').base_output,
    logger = require('@pastash/pastash').logger,
    util = require('util');
var sqdb;
var mysql = require('mysql2');
var bind_query = require('./bind_query');

function OutputMySql() {
    base_output.BaseOutput.call(this);
    this.mergeConfig({
        name: 'MySql',
        optional_params: ['db', 'query', 'host', 'user', 'password', 'port', 'interval_ms'],
        default_values: {
            'db' : 'database',
            'host': '127.0.0.1',
            'port': 3306,
            'user': 'root',
            'password': 'admin',
            'interval_ms': 10000,
            'query': bind_query.DEFAULT_QUERY
        },
        start_hook: this.start,
    });
}
OutputMySql.prototype.start =function(callback) {
    if (this.db) {
        try {
            var cfg = { database: this.db, rowsAsArray: true, multipleStatements: false };
            if(this.host) cfg.host = this.host;
            if(this.port) cfg.port = this.port;
            if(this.user) cfg.user = this.user;
            if(this.password) cfg.password = this.password;
            sqdb = mysql.createConnection(cfg);
            logger.info('Initializing Output MySql:',this.db);
        } catch(e) { logger.error('Failed Initializing Output MySql',e); }
    }

    logger.info('Initialized Output MySql');
    callback();
}
util.inherits(OutputMySql, base_output.BaseOutput);

OutputMySql.prototype.process = function(data) {
    var payload;
    var bound;

    if (!sqdb) {
        logger.error('MySQL output is not connected');
        return;
    }
    payload = JSON.stringify(data, null, 2);
    bound = bind_query.bindEventQuery(this.query, payload);
    sqdb.query(bound.sql, bound.params, function(err) {
        if (err) {
            logger.error('MySQL query error:', err);
        }
    });
};

OutputMySql.prototype.close = function(callback) {
    logger.info('Closing mysql');
    callback();
};

exports.create = function() {
    return new OutputMySql();
};
