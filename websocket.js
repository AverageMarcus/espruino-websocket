var sha1 = require('sha1');
var strChr = String.fromCharCode;

function buildKey() {
  var randomString = btoa(Math.random().toString(36).substr(2, 18));
  var toHash = randomString + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  return {
    source: randomString,
    hashed: btoa(sha1(toHash))
  }
}

function WebSocket(host, options) {
  this.socket = null;
  options = options || {};
  this.host = host;
  this.port = options.port || 80;
  this.protocolVersion = options.protocolVersion || 13;
  this.origin = options.origin || "Espruino";
  this.keepAlive = options.keepAlive * 1000 || 60000;
  this.masking = options.masking || true;
  this.path = options.path || "/";
  this.lastData = "";
  this.key = buildKey();
  this.connected = false;
  this.handshakeDone = false;
  this.initializeConnection();
}

WebSocket.prototype.initializeConnection = function () {
  require("net").connect({
    host: this.host,
    port: this.port
  }, this.onConnect.bind(this));
};

WebSocket.prototype.onConnect = function (socket) {
  this.socket = socket;
  var ws = this;
  socket.on('data', this.parseData.bind(this));

  socket.on('close', function () {
    if (ws.pingTimer) {
      clearInterval(ws.pingTimer);
      ws.pingTimer = undefined;
    }
    ws.emit('close');
  });

  this.handshake();
};

WebSocket.prototype.parseData = function (data) {
  var ws = this;
  this.emit('rawData', data);

  if (this.lastData.length) {
    data = this.lastData+data;
    this.lastData = "";
  }

  // FIXME - not a good idea!
  if (data.indexOf(this.key.hashed) > -1 && data.indexOf('\r\n\r\n') > -1) {
    this.pingTimer = setInterval(function () {
      ws.send('ping', 0x89);
    }, this.keepAlive);
    data = data.substring(data.indexOf('\r\n\r\n') + 4);
    this.handshakeDone = true;
  }

  var opcode = data.charCodeAt(0)&15;

  if (opcode == 0x9) {
    this.send('pong', 0x8A);
    return this.emit('ping');
  }
  
  if (opcode == 0xA) {
    return this.emit('pong');
  }

  if (opcode == 0x1 || opcode == 0x0) {
    var dataLen = data.charCodeAt(1)&127;
    var offset = 2;
    if (dataLen==126) {
      dataLen = data.charCodeAt(3) | (data.charCodeAt(2)<<8);
      offset += 2;
    } else if (dataLen==127) throw "Messages >65535 in length unsupported";

    var mask = [ 0,0,0,0 ];
    if (data.charCodeAt(1)&128 /* mask */) {
      mask = [ data.charCodeAt(offset++), data.charCodeAt(offset++),
               data.charCodeAt(offset++), data.charCodeAt(offset++)];
    }

    if (dataLen+offset > data.length && opcode != 0x0 && data.length != 0) {
      // we received the start of a packet, but not enough of it for a full message.
      // store it for later, so when we get the next packet we can do the whole message
      this.lastData = data;
      return;
    }

    var msg = "";
    for (var i = 0; i < dataLen; i++) {
      msg += String.fromCharCode(data.charCodeAt(offset++) ^ mask[i&3]);
    }
    this.lastData = data.substr(offset);
  
    if(this.connected) {
      this.lastData = '';
      return this.emit('message', msg);
    } else if(this.handshakeDone) {
      this.lastData = '';
      this.connected = true;
      return this.emit('open', data.length ? data.substring(data.indexOf('{')) : data);
    }
  }
  this.lastData = data;
};

WebSocket.prototype.handshake = function () {
  var socketHeader = [
    "GET " + this.path + " HTTP/1.1",
    "Host: " + this.host,
    "Upgrade: websocket",
    "Connection: Upgrade",
    "Sec-WebSocket-Key: " + this.key.source,
    "Sec-WebSocket-Version: " + this.protocolVersion,
    "Origin: " + this.origin,
    "",""
  ];
  this.socket.write(socketHeader.join("\r\n"));
};

WebSocket.prototype.send = function (msg, opcode) {
  opcode = opcode === undefined ? 0x81 : opcode;
  var size = msg.length;
  if (msg.length>125) {
    size = 126;
  }
  this.socket.write(strChr(opcode, size + ( this.masking ? 128 : 0 )));
  
  if (size == 126) {
    this.socket.write(strChr(msg.length >> 8));
    this.socket.write(strChr(msg.length));
  }
  
  if (this.masking) {
    var mask = [];
    var masked = '';
    for (var ix = 0; ix < 4; ix++){
      var rnd = Math.floor( Math.random() * 255 );
      mask[ix] = rnd;
      masked += strChr(rnd);
    }
    for (var ix = 0; ix < msg.length; ix++)
      masked += strChr(msg.charCodeAt(ix) ^ mask[ix & 3]);
    this.socket.write(masked);
  } else {
    this.socket.write(msg);
  }
};

exports = WebSocket;
