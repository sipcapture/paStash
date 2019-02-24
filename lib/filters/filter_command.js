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
            'plugins': null
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
    this.pluginsData.forEach(plugin => {
        try {
            sys.plugin([{ plugin: require(plugin.plugin), conf: plugin.conf }]);

            logger.info('Finish loding 3 ', plugin.plugin);
        } catch (e) {
            logger.error('Error loading Command plugin ' + plugin.plugin, e)
        }
    });

    // logger.info('Initializing Plugins list ...');
    // plugList = []
    // if (this.plugins.constructor.name === "Array") {
    //     plugList = this.plugins
    // } else if (this.plugins.constructor.name === "String") {
    //     plugList.push(this.plugins)
    // }

    // plugList.forEach(function (pluginName) {
    //     logger.info('start loding 2', pluginName);
    //     try {
    //         sys.plugin([{ plugin: require(pluginName), conf: { time: 4000 } }]);

    //         logger.info('Finish loding 3 ', pluginName);
    //     } catch (e) {
    //         logger.error('Error loading Command plugin ' + pluginName, e)
    //     }

    // })

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
            self.markCommand(commandName, 'run')
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
