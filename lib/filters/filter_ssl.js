var base_filter = require('../lib/base_filter'),
  util = require('util'),
  logger = require('log4node');

var fs = require('fs');
var ursa = require('ursa');
var crt,key,msg;

function FilterSSLDecode() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'SSLDecode',
    required_params: ['source_field', 'privateKey', 'publicKey'],
    optional_params: ['debug'],
    start_hook: this.start,
  });
}

util.inherits(FilterSSLDecode, base_filter.BaseFilter);

FilterSSLDecode.prototype.start = function(callback) {

  this.sslkey = ursa.createPrivateKey(fs.readFileSync(this.privateKey));
  this.sslcrt = ursa.createPublicKey(fs.readFileSync(this.publicKey));
  logger.info('Initialized SSLDec for field:' + this.source_field);
  callback();
};

FilterSSLDecode.prototype.process = function(data) {
  if (data[this.source_field] && data[this.source_field] != "") {
    // if (this.debug) logger.info('SSL SOURCE:',data[this.source_field]);
    try {
	//data[this.source_field] = this.sslkey.decrypt(data[this.source_field].toString('base64'), 'base64', 'utf8', ursa.RSA_NO_PADDING)
	data[this.source_field] = this.sslkey.decrypt(data[this.source_field].toString('base64'), 'base64', 'utf8')
	data.type = 'SSL';
    	return data;

    } catch (e) { 
	logger.debug('Failed decrypting SSL',e); 
	data[this.source_field] = data[this.source_field].toString('base64')
	return data; }
  }

};
exports.create = function() {
  return new FilterSSLDecode();
};
