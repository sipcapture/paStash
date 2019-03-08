/*
   Command Module for paStash-NG using plugMeIn/Aggro
   (C) 2017 QXIP BV
*/
var base_filter = require('../lib/base_filter'),
    util = require('util'),
    logger = require('log4node'),
    fs = require('fs');

var asyncChainable = require('async-chainable');
var CircularJSON = require('circular-json');

/* IO Metrics */
var io = false;
try {
    io = require('pmx').probe();
} catch (e) {
    logger.error("Np pmx found", e)
}
var commandMark = {};
var plug = require('zephyr')
var sys = plug();
// In the below examples we assume fooFunc, barFunc, bazFunc and quzFunc functions look something like this:


let commandsByPlugin = {};

let logResult = {
    PluginName: null,
    FunctionName: null,
    Index: null,
    StartTime: 0,
    EndTime: 0,
    Duration: 0,
};

const logStart = (args) => {
    logResult = { ...logResult, ...args };
    logResult.StartTime = (new Date).getTime();
};

const logEnd = function () {
    logResult.EndTime = (new Date).getTime();
    logResult.Duration = logResult.EndTime - logResult.StartTime;

    this.data[self.fieldResultList][logResult.Index] = { ...this.data[self.fieldResultList][logResult.Index], ...logResult };
};

const getPluginNameByCommandName = (commandName) => {
    const pluginName = Object.keys(commandsByPlugin).find(pluginKey => {
        return commandsByPlugin[pluginKey].indexOf(commandName) !== -1;
    });

    return pluginName;
};

function FilterCommand() {
    base_filter.BaseFilter.call(this);
    this.mergeConfig({
        name: 'Command',
        optional_params: ['debug', 'cmd', 'plugins_path', 'plugins', 'field', 'bypass', 'strict', 'fieldCommandList', 'fieldResultList', 'commandList'],
        default_values: {
            'debug': false,
            'bypass': false,
            'strict': false,
            'field': 'message',
            'fieldCommandList': 'CommandList',
            'fieldResultList': 'ResultList',
            'commandList': [],
            'plugins': null,
            'plugins_path': null
        },
        start_hook: this.start,
    });
}

util.inherits(FilterCommand, base_filter.BaseFilter);

FilterCommand.prototype.loadPlugins = function () {
    this.pluginsData = JSON.parse(fs.readFileSync(this.plugins, { encoding: 'utf-8' }));
}

FilterCommand.prototype.start = function (callback) {
    this.loadPlugins();

    logger.info('Initializing Plugins list ...');

    let capturedCommandNames = [];

    for (var plugin in this.pluginsData) {
        logger.info('start loding 2', plugin);
        try {
            if (this.plugins_path) {
                try {
                    sys.plugin([{ plugin: require(this.plugins_path + plugin), conf: this.pluginsData[plugin] }]);
                } catch (e) {
                    sys.plugin([{ plugin: require(plugin), conf: this.pluginsData[plugin] }]);
                    console.log('plugin :' + plugin + ' was load from global');
                }
            } else {
                sys.plugin([{ plugin: require(plugin), conf: this.pluginsData[plugin] }]);
            }

            logger.info('Finish loding 3 ', plugin);

            const pluginCommandNames = Object.keys(sys).filter(it => ['Type', 'plugin'].indexOf(it) === -1);

            commandsByPlugin[this.pluginsData[plugin].pluginFieldName || plugin] = pluginCommandNames.filter(it => capturedCommandNames.indexOf(it) === -1);
            capturedCommandNames = [...pluginCommandNames];
        } catch (e) {
            logger.error('Error loading Command plugin ' + plugin, e)
        }
    }

    callback();
};

FilterCommand.prototype.process = function (data) {
    self = this;
    try {
        try {
            data = JSON.parse(data[this.field]);
        } catch (err) {
            data = data[this.field];
        }

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
        commandNameList.forEach(function (commandName, index) {
            self.markCommand(commandName, 'run');

            const command = function (next) {
                const args = arguments;
                const _this = this;

                logStart({
                    PluginName: getPluginNameByCommandName(commandName),
                    FunctionName: commandName,
                    Index: index,
                });


                var taskFinishHOF = function (logEnd, fn) {
                    return function () {
                        logEnd.apply(_this, arguments);
                        return fn.apply(_this, arguments);
                    };
                };

                args[0] = taskFinishHOF(logEnd, args[0]);

                const result = sys[commandName].apply(_this, args);
            };

            commandArray.push(command);
        });



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
FilterCommand.prototype.markCommand = function (commandName, markType) {
    if (io) {
        if (!commandMark[commandName + '_' + markType]) {
            commandMark[commandName + '_' + markType] = io.meter({
                name: commandName + '_' + markType + '_cps',
                type: 'meter'
            })
        }
        if (this.debug) { logger.info(commandName + '_' + markType + " was mark") }
        commandMark[commandName + '_' + markType].mark();

    };
}

exports.create = function () {
    return new FilterCommand();
};
