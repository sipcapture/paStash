
var CircularJSON = require('circular-json');
var conf,
    defaultConf = {
        timeout: 3000,
    };
module.exports = function plugin(userConf) {

    conf = { ...defaultConf, ...userConf };
    // decorate class prototype
    this.main.chain = function (next) {
        // calling next  this to allow chaining on this function
        next();
    }
    //Some demo staff nedd to clean there for async test concept 
    this.main.fooFunc = demoFuncaion
    this.main.barFunc = demoFuncaion
    this.main.bazFunc = demoFuncaion
}
//Some demo staff nedd to clean there for async test concept 
var demoFuncaion = function (next) {
    console.log(CircularJSON.stringify(this.data));

    setTimeout(function () {
        next(null, arguments.callee.toString().substr(0, 3) + ' value'); // Continue on with 'foo value', 'bar value' etc.
        console.log(arguments.callee.name)
    }.bind(this), Math.random() * conf.timeout); // After a random wait of up to a second

};
