var yawl = require('yawl');
var url = require('url');
var fs = require('fs');
var http = require('http');
var https = require('https');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

exports.createClient = createClient;
exports.GrooveBasinRemote = GrooveBasinRemote;

function createClient(options) {
  return new GrooveBasinRemote(options);
}

util.inherits(GrooveBasinRemote, EventEmitter);
function GrooveBasinRemote(options) {
  EventEmitter.call(this);
  this.isSecure = isProtocolSecure(options.protocol || "http:");
  this.httpProtocol = this.isSecure ? "https:" : "http:";
  this.wsProtocol = this.isSecure ? "wss:" : "ws:";
  this.hostname = options.hostname || "127.0.0.1";
  this.port = options.port || 16242;

  this.serverTime = null;
  this.serverTimeOffset = null;
  this.token = null;
}

GrooveBasinRemote.prototype.connect = function(cb) {
  var self = this;
  var wsOptions = {
    protocol: self.wsProtocol,
    hostname: self.hostname,
    port: self.port,
    path: '/',
    allowTextMessages: true,
    maxFrameSize: 16 * 1024 * 1024,
  };
  self.ws = yawl.createClient(wsOptions);
  self.ws.on('error', function(err) {
    self.emit('error', err);
  });
  self.ws.on('open', function() {
    self.emit('connect');
  });
  self.ws.on('textMessage', function(message) {
    var parsed;
    try {
      parsed = JSON.parse(message);
    } catch (err) {
      self.emit('error', new Error("invalid JSON from server: " + err.message));
    }
    handleMessage(self, parsed.name, parsed.args);
  });
  self.ws.on('close', function() {
    self.emit('close');
  });
};

GrooveBasinRemote.prototype.close = function() {
  this.ws.close();
};

GrooveBasinRemote.prototype.sendMessage = function(name, args) {
  var self = this;
  var json;
  try {
    json = JSON.stringify({
      name: name,
      args: args,
    });
  } catch (err) {
    self.emit('error', new Error("error converting message to JSON: " + err.message));
  }
  this.ws.sendText(json);
};

GrooveBasinRemote.prototype.httpRequest = function(options, cb) {
  var reqOptions = extend({ 
    protocol: this.httpProtocol,
    hostname: this.hostname,
    port: this.port,
  }, options);
  var mod = this.isSecure ? https : http;
  return mod.request(reqOptions, cb);
};

function isProtocolSecure(protocol) {
  return (/^(wss|https):?$/i).test(protocol);
}

function handleMessage(self, name, args) {
  if (name === 'time') {
    self.serverTime = new Date(args);
    self.serverTimeOffset = new Date(args) - new Date();
  } else if (name === 'token') {
    self.token = args;
  } else if (name === 'user') {
    self.user = args;
  } else if (name === 'lastFmApiKey') {
    self.lastFmApiKey = args;
  } else {
    self.emit('message', name, args);
  }
}

function extend(dest, src) {
  for (var prop in src) {
    dest[prop] = src[prop];
  }
  return dest;
}
