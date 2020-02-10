const cryptoJSON = require('crypto-json')
const algorithm = 'camellia-128-cbc'
const encoding = 'hex'
const keys = [];

function encrypt() {
  this.encrypt = function(input,password){
	return cryptoJSON.encrypt(
	  input, password, {encoding, keys, algorithm}
	)
  };
}

function decrypt() {
  this.decrypt = function(input,password){
	return cryptoJSON.decrypt(
	  input, password, {encoding, keys, algorithm}
	)
  };
}


module.exports = function plugin() {

  // load dependent plugins
  this.plugin([encrypt, decrypt]);

}
