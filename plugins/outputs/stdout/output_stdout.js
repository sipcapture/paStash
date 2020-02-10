let base_output = require('@pastash/pastash').base_output,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

function OutputStdout() {
    base_output.BaseOutput.call(this);
    this.mergeConfig({
        name: 'Stdout',
    });
}

util.inherits(OutputStdout, base_output.BaseOutput);

OutputStdout.prototype.process = (data) =>
    process.stdout.write('[STDOUT] ' + JSON.stringify(data, null, 2) + '\n');

OutputStdout.prototype.close = (callback) => {
    logger.info('Closing stdout');
    callback();
};

exports.create = () => new OutputStdout();

