/*
 * aes256 File Encryption for PaStash Commands
 * (C) 2019 QXIP BV
 */

const encryptor = require('file-encryptor');
let conf;
const defaultConf = {
  algorithm: 'aes256',
  pluginFieldName: 'FileEcryptor'
};

module.exports = function plugin(userConf) {
  conf = { ...defaultConf, ...userConf };
  const options = {
    algorithm: conf.algorithm,
  };

  this.main.encryptFile = function encryptFile(next) {
    const data = this.data[conf.pluginFieldName];
    encryptor.encryptFile(data[conf.inputFileField], data[conf.outputFileField], data[conf.keyField], options, function (err) {
      next();
    });
  }

  this.main.decryptFile = function decryptFile(next) {
    const data = this.data[conf.pluginFieldName];
    encryptor.decryptFile(data[conf.inputFileField], data[conf.outputFileField], data[conf.keyField], options, function (err) {
      next();
    });
  }

}
