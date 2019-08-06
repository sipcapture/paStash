var base_input = require('../lib/base_input'),
  http = require('http'),
  https = require('https'),
  url = require('url'),
    util = require('util'),
    jwt = require('jsonwebtoken'),
    Netmask = require('netmask').Netmask,
  ssl_helper = require('../lib/ssl_helper'),
  logger = require('log4node');
const   subnetList = [];
function InputHttp() {
  base_input.BaseInput.call(this);
  this.mergeConfig(ssl_helper.config());
  this.mergeConfig(this.unserializer_config());
  this.mergeConfig({
    name: 'Http',
    host_field: 'host',
    port_field: 'port',
    optional_params: ['type', 'path' ,'jwt_password','subnet'],
    start_hook: this.start,
  });
}

util.inherits(InputHttp, base_input.BaseInput);

InputHttp.prototype.start = function(callback) {
  logger.info('Start listening on', this.host + ':' + this.port, 'ssl ' + this.ssl);
  logger.info(JSON.stringify(this));
  var _self = this

  if(_self.subnet){
     _self.subnet.split(',').forEach(function (subnetStr) {
            subnetList.push(new Netmask(subnetStr))
     })
    //console.log('remoteAddress',request.connection.remoteAddress  )
    console.log('subnetList',subnetList )

  }

  this.serverCallback = function(request, response) {

    /*Auth Section  Begin By SubNet OR JWT */
      if(subnetList.length>0||_self.jwt_password){
        let authFlag =false
        subnetList.forEach(function (subnetObj) {
            if(subnetObj.contains(request.connection.remoteAddress))authFlag=true
        })
        if(!authFlag&&_self.jwt_password){

          jwt.verify(token, _self.jwt_password, function(err, decoded) {
            if (err) {
              /*
                err = {
                  name: 'TokenExpiredError',
                  message: 'jwt expired',
                  expiredAt: 1408621000
                }
              */
            }else{
              authFlag=true
            }
          });


        }
        if(!authFlag){

          response.writeHead(401);
          response.end();
        }
      }

    /*Auth Section  END By SubNet OR JWT */
    if (this.path){
       if(url.parse(request.url).pathname !== this.path) {
         logger.info('Discarding request to:'+request.url);
         response.writeHead(404);
         response.end();
         return;
       }
    }
    
    var data = '';
    request.on('data', function(chunk) {
      data += chunk.toString();
    });

    request.on('end', function() {
      this.unserialize_data(data, function(parsed) {
        this.emit('data', parsed);
      }.bind(this), function(data) {
        this.emit('data', {
          'message': data.trim(),
          'host': response.remoteAddress,
          'http_port': this.port,
          'path': url.parse(request.url).pathname,
          'type': this.type,
        });
      }.bind(this));
      response.writeHead(201);
      response.end();
    }.bind(this));

    request.on('error', function(err) {
      this.emit('error', err);
    }.bind(this));
  }.bind(this);

  if (this.ssl) {
    this.server = https.createServer(ssl_helper.merge_options(this, {}), this.serverCallback);
    this.server.on('clientError', function(err) {
      this.emit('error', err);
    }.bind(this));
  }
  else {
    this.server = http.createServer(this.serverCallback);
  }

  this.server.on('error', function(err) {
    this.emit('error', err);
  }.bind(this));

  this.server.listen(this.port, this.host);

  this.server.once('listening', callback);
};

InputHttp.prototype.close = function(callback) {
  logger.info('Closing http server', this.host + ':' + this.port, 'ssl ' + this.ssl);
  this.server.close(callback);
};

exports.create = function() {
  return new InputHttp();
};
