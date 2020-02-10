/*
 * S3 Functions for PaStash Commands
 * (C) 2019 QXIP BV
 */
const AWS = require('aws-sdk');
const BluebirdPromise = require('bluebird');
const fs = require("fs");
const crypto = require("crypto");

let conf;
const defaultConf = {
  pluginFieldName: 'FileFetch',
  bucketName: 'fetchBucket'
};

function checksum(str, algorithm, encoding) {
  return crypto
    .createHash(algorithm || 'md5')
    .update(str, 'utf8')
    .digest(encoding || 'hex')
}

function saveObjectToFile(bucket, key, path) {
  return new BluebirdPromise(function (resolve, reject) {
    var s3 = new AWS.S3();
    var params = { Bucket: bucket, Key: key };
    var writeStream = fs.createWriteStream(path);
    var res = {
      etag: null,
      length: null
    }

    s3.getObject(params).on('httpHeaders', function (statusCode, headers) {
      if (headers.etag) {
        res.etag = headers.etag;
      }
      if (headers['content-length']) {
        res.length = headers['content-length'];
      }
    }).createReadStream().pipe(writeStream);

    writeStream.on('finish', function () {
      resolve(res);
    })
      .on('error', function (err) {
        reject('Writestream to ' + path + ' did not finish successfully: ' + err);
      });
  });
};

function deleteObject(bucket, key) {
  return new BluebirdPromise(function (resolve, reject) {
    var s3 = new AWS.S3();
    var params = { Bucket: bucket, Key: key };

    s3.deleteObject(params, function (error, data) {
      if (error) {
        reject(error);
      }
      else {
        resolve(data);
      }
    });
  });
};

module.exports = function plugin(userConf) {
  conf = { ...defaultConf, ...userConf };

  this.main.s3Fetch = function s3Fetch(next) {
    const data = this.data[conf.pluginFieldName];

    AWS.config.update({
      accessKeyId: conf['buckets'][data[conf.bucketField]].accessKeyId,
      secretAccessKey: conf['buckets'][data[conf.bucketField]].secretAccessKey
    });

    saveObjectToFile(data[conf.bucketField], data[conf.nameField], data[conf.outputFileField] + data[conf.nameField]).then((res) => {

      const remoteMd5 = res.etag.replace(/"/g, '');

      fs.readFile(data[conf.outputFileField] + data[conf.nameField], (err, resFile) => {

        if (!remoteMd5) {
          this.data.error = conf.pluginFieldName + ' plugin error cannot get remote md5';
          self.emit('output', this.data);
          return;
        }

        this.data[self.fieldResultList].push({ md5: remoteMd5 });

        if (remoteMd5 !== checksum(resFile)) {
          this.data.error = conf.pluginFieldName + ' plugin error files checksum not match';
          self.emit('output', this.data);
          return;
        }

        next();
      })
    }).catch((err) => {
      this.data.error = conf.pluginFieldName + ' plugin error file fetch error; ' + err;
      self.emit('output', this.data);
    });
  }

  this.main.s3Delete = function s3Fetch(next) {
    const data = this.data[conf.pluginFieldName];

    AWS.config.update({
      accessKeyId: conf['buckets'][data[conf.bucketField]].accessKeyId,
      secretAccessKey: conf['buckets'][data[conf.bucketField]].secretAccessKey
    });

    deleteObject(data[conf.bucketField], data[conf.nameField]).then((res) => {
      next();
    }).catch((err) => {
      this.data.error = conf.pluginFieldName + ' error deleting file; ' + err;
      self.emit('output', this.data);
    });
  }

}
