var base_input = require('../lib/base_input'),
  util = require('util'),
  spawn = require('child_process').spawn,
  logger = require('log4node');

function InputJournald() {
  base_input.BaseInput.call(this);
  this.mergeConfig({
    name: 'Journald',
    allow_empty_host: true,
    optional_params: [
      'type',
      'journalctl',
      'unit',
      'user_unit',
      'priority',
      'since',
      'until',
      'boot',
      'identifier',
      'match',
      'lines',
      'follow',
      'merge_fields',
    ],
    default_values: {
      journalctl: 'journalctl',
      follow: true,
      lines: 0,
      merge_fields: true,
    },
    start_hook: this.start,
  });
}

util.inherits(InputJournald, base_input.BaseInput);

InputJournald.prototype.buildArgs = function() {
  var args = ['-o', 'json'];
  if (this.follow) {
    args.push('-f');
  }
  if (this.lines !== undefined && this.lines !== null && String(this.lines) !== '') {
    args.push('-n', String(this.lines));
  }
  if (this.unit) {
    args.push('-u', this.unit);
  }
  if (this.user_unit) {
    args.push('--user-unit', this.user_unit);
  }
  if (this.priority) {
    args.push('-p', this.priority);
  }
  if (this.since) {
    args.push('--since', this.since);
  }
  if (this.until) {
    args.push('--until', this.until);
  }
  if (this.boot) {
    args.push('-b', this.boot);
  }
  if (this.identifier) {
    args.push('-t', this.identifier);
  }
  if (this.match) {
    args.push(this.match);
  }
  return args;
};

InputJournald.prototype.emitEntry = function(entry) {
  var event = {
    source: 'journald',
    message: entry.MESSAGE || '',
  };
  if (this.type) {
    event.type = this.type;
  }
  if (this.merge_fields) {
    for (var key in entry) {
      if (key !== 'MESSAGE' && event[key] === undefined) {
        event[key] = entry[key];
      }
    }
  }
  this.emit('data', event);
};

InputJournald.prototype.handleStdout = function(chunk) {
  this.line_buffer += chunk.toString();
  var parts = this.line_buffer.split('\n');
  this.line_buffer = parts.pop();
  for (var i = 0; i < parts.length; i++) {
    var line = parts[i].trim();
    if (line === '') {
      continue;
    }
    try {
      this.emitEntry(JSON.parse(line));
    } catch (e) {
      this.emit('error', new Error('Unable to parse journald JSON line: ' + e.message));
    }
  }
};

InputJournald.prototype.start = function(callback) {
  this.line_buffer = '';
  var args = this.buildArgs();
  logger.info('Start journald input:', this.journalctl, args.join(' '));
  this.child = spawn(this.journalctl, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  this.child.stdout.on('data', this.handleStdout.bind(this));
  this.child.stderr.on('data', function(data) {
    var text = data.toString().trim();
    if (text !== '') {
      logger.warning('journalctl stderr:', text);
    }
  });
  this.child.on('error', function(err) {
    this.emit('error', err);
  }.bind(this));
  this.child.on('close', function(code) {
    if (this.closing) {
      return;
    }
    if (this.follow) {
      this.emit('error', new Error('journalctl exited with code ' + code));
      return;
    }
    if (this.line_buffer && this.line_buffer.trim() !== '') {
      try {
        this.emitEntry(JSON.parse(this.line_buffer.trim()));
      } catch (e) {
        this.emit('error', new Error('Unable to parse journald JSON line: ' + e.message));
      }
    }
    if (code !== 0) {
      this.emit('error', new Error('journalctl exited with code ' + code));
    }
  }.bind(this));
  callback();
};

InputJournald.prototype.close = function(callback) {
  logger.info('Closing journald input');
  this.closing = true;
  if (this.child) {
    this.child.kill('SIGTERM');
    this.child = null;
  }
  callback();
};

exports.create = function() {
  return new InputJournald();
};
