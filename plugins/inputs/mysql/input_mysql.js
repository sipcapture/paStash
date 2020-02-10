var base_input = require('@pastash/pastash').base_input,
    util = require('util'),
    logger = require('@pastash/pastash').logger;
var sqdb;
var THIS ;
var mysql = require('mysql2');

function InputMySql() {
    base_input.BaseInput.call(this);
    this.mergeConfig({
        name: 'Mysql',
        optional_params: ['db',  'query', 'host', 'user', 'password', 'port','interval_ms'],
        default_values: {
            'db' : 'db',
            'host': '127.0.0.1',
            'port': 3306,
            'user': 'root',
            'password': 'admin',
            'interval_ms': 10000,
            'qurey': 'call  sp_sync_get_opensips_rows(1)'
        },
        start_hook: this.start,
    });
}

util.inherits(InputMySql, base_input.BaseInput);

InputMySql.prototype.start = function(callback) {
//  process.stdin.resume();
    this.mssql_listener = function(chunk) {
        this.emit('data',chunk );
    }.bind(this);
//  process.stdin.on('data', this.mssql_listener);

    THIS =  this
    if (this.db) {
        try {
            var cfg = { database: this.db, rowsAsArray: true };
            if(this.host) cfg.host = this.host;
            if(this.user) cfg.user = this.user;
            if(this.password) cfg.password = this.password;
            sqdb = mysql.createConnection(cfg);
            logger.info('Initializing Input MySql:',this.db);
        } catch(e){ logger.error('Failed Initializing Filter MySql',e); }
    }


    logger.info('Initialized Filter MySql');
    callback();

    setInterval(function(){
        // console.log("HAPPY NEW YEAR!!");
        // THIS.mssql_listener({FOO:"bar"})

        InputMySql.prototype.ticker(THIS.mssql_listener)
    }, this.interval_ms);

};

InputMySql.prototype.close = function(callback) {
    logger.info('Closing mysql');

    callback();
};

InputMySql.prototype.ticker = function(cb) {

    var rowCounter =0 ;
    //
    ///   cb({data:THIS})
    if (THIS.db) {
        sqdb.query(THIS.qurey ,null, function(err, results, fields) {


            if( results&& results[0].length >0 ){
                console.log("results",JSON.stringify( results))
                console.log("fields",JSON.stringify( fields))
                console.log(JSON.stringify( results[1].fieldCount ))
                console.log("err")
                console.log(JSON.stringify( err))
                console.log("fields")
                results[0].forEach(function (row) {

                    var fieldsCounter =0 ;


                    //   console.log("rowrowrowrowrowrowrowrowrowrowrowrowrow",JSON.stringify( row))


                    var objTemplet = {} ;
                    objTemplet=  Object.assign(objTemplet,row[0])


                    cb(objTemplet)
                    console.log("objTemplet",objTemplet)
                })




            }
        })
    }

};

exports.create = function() {
    return new InputMySql();
};