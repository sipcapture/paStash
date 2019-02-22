const base_input = require('../lib/base_input'),
    util = require('util'),
    logger = require('log4node'),
    axios = require('axios'),
    io = require('socket.io-client');

let servers = null,
    activeSocket = null,
    primaryReconnectCounterId = null;

const primaryReconnectTimeout = 5000;

function InputVoicenter() {
    base_input.BaseInput.call(this);
    this.mergeConfig(this.unserializer_config());
    this.mergeConfig({
        name: 'Voicenter Event',
        optional_params: ['api', 'token'],
        start_hook: this.start,
    });
}

util.inherits(InputVoicenter, base_input.BaseInput);

const convertUrl = (server) => {
    const protocol = (server.split(":")[1] == 443) ? 'https://' : 'http://';
    return protocol + server;
}

InputVoicenter.prototype.loadServers = async function () {
    if (servers) return true;

    for (let i = 0; i < this.api.length; i++) {
        let apiUrl = this.api[i] + this.token;
        logger.info('getting data from api ' + apiUrl + '...');

        servers = await axios.get(apiUrl)
            .then(response => {
                return response.data
                    .sort((a, b) => a.Priority - b.Priority)
                    .map(it => it.Domain);
            })
            .catch(error => {
                this.emit('error connecting api. error', error);
                logger.info('error connecting api. error' + error);
                return false;
            });
        if (servers) break;
    }
};

InputVoicenter.prototype.connect = function (server, socket) {
    return new Promise((resolve) => {

        socket = io(convertUrl(server), {
            transports: ['polling'],
            path: '/socket.io/',
            secure: true,
            reconnection: false

        });

        socket.on('connect_error', () => {
            // this.emit('error', error);
            logger.info('error connecting to ' + server);
            resolve(false);
        });

        socket.on('ExtensionEvent', (data) => {
            this.emit('ExtensionEvent', data);
            logger.info('Emitting message: ', data);
        });

        socket.on('connect', () => {
        }).emit('login', { token: this.token });

        socket.on('loginStatus', (data) => {
            if (!data.errorCode) {
                logger.info('connected to server ' + server);
                resolve({ status: true, newSocket: socket });
            } else {
                logger.info('auth error, code ' + data.errorCode);
                this.emit('auth error, code ' + data.errorCode);
                resolve(false);
            }
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
    const isPrimary = () => activeSocket.io.uri === convertUrl(servers[0]);

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
    await this.loadServers();

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
