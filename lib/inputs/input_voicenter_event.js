var base_input = require('../lib/base_input'),
    fs = require('fs'),
    util = require('util'),
    logger = require('log4node');

const io = require('socket.io-client');

let servers = null;
let activeSocket = null;
let primaryReconnectCounterId = null;
const primaryReconnectTimeout = 4000;

function InputVoicenter() {
    base_input.BaseInput.call(this);
    this.mergeConfig(this.unserializer_config());
    this.mergeConfig({
        name: 'Voicenter',
        optional_params: ['file_path'],
        start_hook: this.start,
    });
}

util.inherits(InputVoicenter, base_input.BaseInput);

InputVoicenter.prototype.loadServers = function () {
    if (servers) return;
    servers = JSON.parse(fs.readFileSync(this.file_path, 'utf8'))
        .sort((a, b) => a.Priority - b.Priority)
        .map(it => it.Domain);
};

InputVoicenter.prototype.connect = function (server, socket) {
    return new Promise((resolve) => {
        socket = io(server, { reconnection: false });

        socket.on('connect_error', () => {
            // this.emit('error', error);
            logger.info('connecting to ' + server + ' false');
            resolve(false);
        });

        socket.on('data', (data) => {
            this.emit('data', data);
            logger.info('Emitting data: ', data);
        });

        socket.on('connect', () => {
            logger.info('connected to server ' + server);
            resolve({ status: true, newSocket: socket });
        });

        socket.on('disconnect', (reason) => {
            logger.info('disconected from server ' + server);
            if (reason !== 'io client disconnect') {
                this.establishSocket();
            }
        });
    });
}

InputVoicenter.prototype.scheduleRetryConnectToPrimaryServer = function () {
    if (primaryReconnectCounterId) clearTimeout(primaryReconnectCounterId);
    const isPrimary = () => activeSocket.io.uri === servers[0];

    if (isPrimary()) return;
    logger.info('Trying Connect to Primary!!!');

    const producer = () => {
        this.connect(servers[0]).then(({ status, newSocket }) => {
            if (status) {
                activeSocket.close();
                logger.info('Connected to Primary!!!');
                activeSocket = newSocket;
            }
            else {
                primaryReconnectCounterId = setTimeout(producer, primaryReconnectTimeout);
            }
        });
    };

    primaryReconnectCounterId = setTimeout(producer, primaryReconnectTimeout);
}

InputVoicenter.prototype.establishSocket = async function () {
    this.loadServers();

    let connection = null;
    for (let i = 0; i < servers.length; i++) {
        let server = servers[i];
        logger.info('connecting to ' + server + '...');

        connection = await this.connect(server, activeSocket)
            .then(({ status, newSocket }) => {
                if (status) {
                    activeSocket = newSocket;
                    this.scheduleRetryConnectToPrimaryServer();
                }
                return status;
            });
        if (connection) break;
    }

    if (!connection) {
        await this.establishSocket();
    }
};

InputVoicenter.prototype.start = function (callback) {
    this.establishSocket();
    callback();
};

InputVoicenter.prototype.close = function (callback) {
    logger.info('Closing Voicenter socket');
    callback();
};

exports.create = function () {
    return new InputVoicenter();
};
