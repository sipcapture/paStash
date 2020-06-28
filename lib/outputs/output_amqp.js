var base_output = require('../lib/base_output'),
    ssl_helper = require('../lib/ssl_helper'),
    util = require('util'),
    logger = require('log4node'),
    amqplib = require('amqplib'),
    error_buffer = require('../lib/error_buffer');

function OutputAmqp() {
  base_output.BaseOutput.call(this);
  this.mergeConfig(this.serializer_config('json_logstash'));
  this.mergeConfig(ssl_helper.config());
  this.mergeConfig(error_buffer.config(function() {
    return 'amqp to ' + this.host + ':' + this.port + ' exchange ' + this.exchange_name;
  }));
  this.mergeConfig({
    name: 'Ampq',
    required_params: ['exchange_name','host','port'],
    optional_params: ['topic', 'durable', 'retry_delay', 'heartbeat', 'username', 'password', 'vhost', 'persistent','ssl','response'],
    default_values: {
      'durable': true,
      'retry_delay': 3000,
      'heartbeat': 10,
      'persistent': false,
      'ssl': false,
      'response': false
    },
    start_hook: this.start,

  });
}

util.inherits(OutputAmqp, base_output.BaseOutput);

OutputAmqp.prototype.start = function(callback) {
  this.buildUrl();
  this.connect();
  callback();
};

OutputAmqp.prototype.buildUrl = function() {
  this.url = (this.ssl ? 'amqps' : 'amqp') + '://';
  if (this.username && this.password) {
    this.url += this.username + ':' + this.password + '@';
  } else if(this.username) {
    this.url += this.username + '@';
  }
  this.url += this.host + ':' + this.port;
  if (this.vhost) {
    this.url += this.vhost;
  }
  if(this.hasOwnProperty('heartbeat')) {
    this.url += '?heartbeat=' + this.heartbeat;
  }
};

OutputAmqp.prototype.registerEvents = function(conn) {
  let self = this;

  conn.on('error',function(err){
    console.error(err);
  });

  conn.on('close', function() {
    self.channel = null;
    self.currentConnection = null;
    if(!self.closing) {
      console.log(`Connection lost.Will attempt to reconnect in ${self.retry_delay}`);
      self.reconnect();
    }
  });
};

OutputAmqp.prototype.registerChannelEvents = function(channel) {
  let self = this;

  channel.on('error',function(err){
    console.error(err);
  });

  channel.on('close', function() {
    self.channel = null;
    self.currentConnection = null;
    if(!self.closing) {
      console.log(`Connection lost.Will attempt to reconnect in ${self.retry_delay}`);
      setTimeout(self.reconnect.bind(self), self.retry_delay);
    }
  });

  channel.on('return', function(msg) {
    console.error(msg.fields.replyText);
    console.error(self.url);
    msg.content = JSON.parse(msg.content.toString());
    console.error(JSON.stringify(msg));
    // let content = msg.content;
    // let options = msg.properties;
    // for(let key in options) {
    //     if(!options[key]) {
    //         delete options[key];
    //     }
    // }
    // setTimeout(()=>{
    //     console.log('Sending again');
    //     self.publish(content,options);
    // },10000);
  });
};

OutputAmqp.prototype.publish = function(message,options){
  let self = this;
  if (this.channel && this.currentConnection) {
    if(Object.keys(message).length!==0) {
      this.channel.publish(this.exchange_name, this.topic || '', new Buffer.from(JSON.stringify(message)), options, ((err) => {
        if (err) return logger.error(err);
        logger.info(`Published to ${self.exchange_name}`);
      }));
    }
  }
};

OutputAmqp.prototype.reconnect = function() {
  let self = this;
  setTimeout(()=>{
    self.connect().then(() => {
      clearTimeout(self.reconnect);
    }).catch((err) => console.error(err));
  },self.retry_delay);
};

OutputAmqp.prototype.connect = function(){
  let self = this;
  return new Promise((resolve,reject) => {
    amqplib.connect(this.url + '?heartbeat=' + this.heartbeat , {}).then((conn) => {
      logger.info(`AMQP Connected to ${self.url}`);
      self.currentConnection = conn;
      self.registerEvents(conn);
      return conn.createConfirmChannel();
    }).then((channel) => {
      logger.info(`AMQP Channel created in ${self.url}`);
      self.channel = channel;
      self.registerChannelEvents(channel);
      channel.checkExchange(self.exchange_name).then(() => {
        resolve(1);
      }).catch(() => {
        logger.info(`AMQP Exchange ${self.exchange_name} asserted in ${self.url}`);
        return channel.assertExchange(self.exchange_name, self.topic ? 'topic' : 'fanout', {durable: self.durable});
      });
    }).then(() => {
      resolve(1);
    }).catch((err) => {
      logger.error(`AMQP Error in ${self.url} . ${err}`);
      if(err.code !== 'EHOSTUNREACH' || err.statusCode !== 403) {
        setTimeout(self.reconnect.bind(self), self.retry_delay);
      }
      reject(0);
    });
  });
};

OutputAmqp.prototype.process = async function(data) {
  data = await data;
  if(!data) return;
  let options = {};
  if(typeof data === 'object') {
    if(data.hasOwnProperty('type_pastash')) {
      delete data.type_pastash;
    }
    delete data.host;
    if(data.options_type) {
      options.type = data.options_type;
      delete data.options_type;
    }
  }
  if (this.channel && this.currentConnection) {
    if (this.persistent) {
      options.persistent = true;
    }
    if(this.parsed_url.params.options_header) {
      options.headers = {};
      if(Array.isArray(this.parsed_url.params.options_header)) {
        this.parsed_url.params.options_header.forEach((header) => {
            options.headers[header] = "true";
        });
      } else {
        options.headers[this.parsed_url.params.options_header] = "true";
      }
    }
    console.log('data: ',JSON.stringify(data));
    console.log('options: ',JSON.stringify(options));
    this.publish(data, options);
  }
};

OutputAmqp.prototype.close = function(callback) {
  this.closing = true;
  if(this.currentConnection) {
    this.currentConnection.close();
    logger.info('AMQP Close');
  }
  this.currentConnection = null;
  this.channel = null;
  callback();
};

exports.create = function() {
  return new OutputAmqp();
};
