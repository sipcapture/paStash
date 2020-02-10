/*
 * Upload and check file for PaStash Commands
 * (C) 2019 QXIP BV
 */

const PromiseFtp = require("promise-ftp");

let conf;
const defaultConf = {
  pluginFieldName: 'FieTransfer',
  port: 21,
  user: 'anonymous',
};

module.exports = function plugin(userConf) {
  conf = { ...defaultConf, ...userConf };

  this.main.uploadFile = async function uploadFile(next) {
    const data = this.data[conf.pluginFieldName];

    var ftp = new PromiseFtp();
    ftp.connect({
      host: conf.host,
      port: conf.port,
      user: conf.user,
      password: conf.password
    })
      .then(async () => {
        await ftp.mkdir(data[conf.outputFileField], true);

        await ftp.put(
          data[conf.inputFileField] + data[conf.nameField],
          data[conf.outputFileField] + data[conf.nameField]);

        ftp.list(data[conf.outputFileField]).then((list) => {
          const file = list.find(it => it.name === data[conf.nameField] + '54564');

          if (!file) {
            ftp.end();
            this.data.error = conf.pluginFieldName + ' plugin error file not uploaded';
            self.emit('output', this.data);
            return;
          }

          if (file.size !== data[conf.sizeField]) {
            ftp.end();
            this.data.error = conf.pluginFieldName + ' plugin error file size not to match';
            self.emit('output', this.data);
            return;
          } else {
            ftp.end();
            next();
          }
        });

      }).catch((err) => {
        this.data.error = conf.pluginFieldName + ' plugin error connecting server; ' + err;
        self.emit('output', this.data);
      })
  }
}
