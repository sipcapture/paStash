var base_output = require('@pastash/pastash').base_output,
    logger = require('@pastash/pastash').logger,
    util = require('util');
var sqdb;
var THIS ;
var mysql = require('mysql2');

function OutputMySql() {
    base_output.BaseOutput.call(this);
    this.mergeConfig({
        name: 'MySql',
        optional_params: ['db',  'query', 'host', 'user', 'password', 'port','interval_ms'],
        default_values: {
            'db' : 'database',
            'host': '127.0.0.1',
            'port': 3306,
            'user': 'root',
            'password': 'admin',
            'interval_ms': 10000,
            'qurey': "call SP_UpdateSyncResult('{|data|}');"
        },
        start_hook: this.start,
    });
}
OutputMySql.prototype.start =function(callback) {
    THIS =  this
    if (this.db) {
        try {
            var cfg = { database: this.db, rowsAsArray: true };
            if(this.host) cfg.host = this.host;
            if(this.user) cfg.user = this.user;
            if(this.password) cfg.password = this.password;
            sqdb = mysql.createConnection(cfg);
            logger.info('Initializing Outpu MySql:',this.db);
        } catch(e){ logger.error('Failed Initializing Filter MySql',e); }
    }


    logger.info('Initialized Filter MySql');
    callback();


}
util.inherits(OutputMySql, base_output.BaseOutput);

OutputMySql.prototype.process = function(data) {

    process.stdout.write('[STDOUT] ' + JSON.stringify(data, null, 2) + '\n');
    var sqlstr = THIS.qurey
    sqlstr= sqlstr.replace('{|data|}',JSON.stringify(data, null, 2) )

    console.log(sqlstr );
    sqdb.query(sqlstr ,null, function(err, results, fields) {

        sqlstr= sqlstr.replace('{|data|}',JSON.stringify(results, null, 2) )
    })
};

OutputMySql.prototype.close = function(callback) {
    logger.info('Closing mysql');
    callback();
};

exports.create = function() {
    return new OutputMySql();
};
