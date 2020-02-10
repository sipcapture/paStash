/*
   Command Module for paStash-NG using plugMeIn/Aggro
   (C) 2017 QXIP BV
*/
var base_filter = require('@pastash/pastash').base_filter,
  util = require('util'),
  logger = require('@pastash/pastash').logger;

var asyncChainable = require('async-chainable');
var CircularJSON = require('circular-json');

var plug = require('zephyr')
var sys = plug();
// In the below examples we assume fooFunc, barFunc, bazFunc and quzFunc functions look something like this:



function FilterCommand() {
  base_filter.BaseFilter.call(this);
  this.mergeConfig({
    name: 'Command',
    optional_params: ['debug', 'cmd', 'plugins', 'field', 'bypass', 'strict', 'fieldCommandList', 'fieldResultList', 'commandList'],
    default_values: {
      'debug': false,
      'bypass': false,
      'strict': false,
      'field': 'message',
      'fieldCommandList': 'CommandList',
      'fieldResultList': 'ResultList',
      'commandList': [],
      'plugins': [],
    },
    start_hook: this.start,
  });
}

util.inherits(FilterCommand, base_filter.BaseFilter);

FilterCommand.prototype.start = function (callback) {

  logger.info('Initializing Plugins list ...');
  plugList = []
  if (this.plugins.constructor.name === "Array") {
    plugList = this.plugins
  } else if (this.plugins.constructor.name === "String") {
    plugList.push(this.plugins)
  }

  plugList.forEach(function (pluginName) {

    logger.info('start loding ', pluginName);
    try {

      sys.plugin([require(pluginName)]);
      logger.info('Finish loding ', pluginName);
    } catch (e) {
      logger.error('Error loading Command plugin ' + pluginName, e)
    }

  })

  callback();
};

FilterCommand.prototype.process = function (data) {
  self = this;
  try {
    data = JSON.parse(data[this.field]);
    let commandNameList = []
    if (data[this.fieldCommandList]) {
      if (data[this.fieldCommandList].constructor.name === "String") {
        commandNameList.push(data[this.fieldCommandList])
      } else if (data[this.fieldCommandList].constructor.name === "Array") {
        data[this.fieldCommandList].forEach(function (command) {
          commandNameList.push(command)
        })
      }
    }
    else {
      if (this.commandList.length == 0) {
        logger.error("cant find " + this.fieldCommandList + "in Object=>", CircularJSON.stringify(data))
      } else {
        this.commandList.forEach(function (command) {
          commandNameList.push(command)
        })
      }

    }
    let commandArray = [];
    commandNameList.forEach(function (commandName) {
      commandArray.push(sys[commandName])
    })



    data[self.fieldResultList] = []
    asyncChainable().set('data', data)
      .series(commandArray)
      .end(function () {
        if (this.debug) logger.info('COMMANDS OUT', this.data);
        self.emit('output', this.data);
      }
      )

    //	return data;
  } catch (e) {
    if (this.debug) logger.info(e);
    if (this.bypass) return data;
  }

};

exports.create = function () {
  return new FilterCommand();
};
