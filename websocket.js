/* Copyright (c) 2015 Sameh Hady, Gordon Williams. See the file LICENSE for copying permission. */
/*
 Simple WebSocket protocol wrapper for Espruino sockets.

 * KEYWORDS: Module,websocket,ws,socket

 Websocket implementation on Espruino, it let you control your Espruino from the cloud without the need to know it's IP.
 You will need to use it with a websocket server.

 How to use the ws module:

 ```javascript
 // Connect to WiFi, then...

 // =============================== CLIENT
 var WebSocket = require("ws");
 var ws = new WebSocket("HOST",{
      path: '/echo',
      port: 8080,
      protocolVersion: 13,
      origin: 'Espruino',
      keepAlive: 60  // Ping Interval in seconds.
    });

 ws.on('open', function() {
   console.log("Connected to server");
 });

 ws.on('message', function(msg) {
   console.log("MSG: " + msg);
 });

 ws.on('close', function() {
   console.log("Connection closed");
 });

 //Send message to server
 ws.send("Hello Server");

 // =============================== SERVER
 var page = '<html><body><script>var ws;setTimeout(function(){';
 page += 'ws = new WebSocket("ws://" + location.host + "/my_websocket", "protocolOne");';
 page += 'ws.onmessage = function (event) { console.log("MSG:"+event.data); };';
 page += 'setTimeout(function() { ws.send("Hello to Espruino!"); }, 1000);';
 page += '},1000);</script></body></html>';

 function onPageRequest(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end(page);
 }

 var server = require('ws').createServer(onPageRequest);
 server.listen(8000);
 server.on("websocket", function(ws) {
    ws.on('message',function(msg) { print("[WS] "+JSON.stringify(msg)); });
    ws.send("Hello from Espruino!");
 });
```
*/

/** Minify String.fromCharCode() call */
var strChr = String.fromCharCode;
var crypto = require('crypto');

function buildKey() {
  var randomString = btoa(Math.random().toString(36).substr(2, 18));
  var toHash = randomString + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  return {
    source: randomString,
    hashed: btoa(crypto.SHA1(toHash))
  }
}

function WebSocket(host, options) {
  this.socket = null;
  options = options || {};
  this.host = host;
  this.port = options.port || 80;
  this.protocolVersion = options.protocolVersion || 13;
  this.origin = options.origin || 'Espruino';
  this.keepAlive = options.keepAlive * 1000 || 60000;
  this.masking = options.masking || true;
  this.path = options.path || "/";
  this.lastData = "";
  this.key = buildKey();
  this.connected = false;
  this.handshakeDone = false;
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
  // see https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
  // Note, docs specify bits 0-7, etc - but BIT 0 is the MSB, 7 is the LSB
  // TODO: handle >1 data packet
  var ws = this;
  this.emit('rawData', data);

  if (this.lastData.length) {
    data = this.lastData+data;
    this.lastData="";
  }

  // FIXME - not a good idea!
  if (data.indexOf(this.key.hashed) > -1 && data.indexOf('\r\n\r\n') > -1) {
      this.emit('handshake');
    this.pingTimer = setInterval(function () {
      ws.send('ping', 0x89);
    }, this.keepAlive);
    data = data.substring(data.indexOf('\r\n\r\n') + 4);
    this.handshakeDone = true;
  }

  // If a packet contains data spanning two frames we need to split these up so we can handle them individually
  var nextFrame;
  if(data.indexOf(String.fromCharCode(129)) !== data.lastIndexOf(String.fromCharCode(129))) {
    var nextFrameStartPos = data.indexOf(String.fromCharCode(129), data.indexOf(String.fromCharCode(129))+1);
    nextFrame = data.substring(nextFrameStartPos);
    data = data.substring(0, nextFrameStartPos);
  }

  var opcode = data.charCodeAt(0)&15;

  if (opcode == 0xA)
    return this.emit('pong');

  if (opcode == 0x9) {
    this.send('pong', 0x8A);
    return this.emit('ping');
  }

  if (opcode == 0x8 && this.connected) {
    // connection close request but only once we have confirmed the websocket is connected
    this.socket.end();
    // we'll emit a 'close' when the socket itself closes
    return;
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
      this.emit('message', msg);
    } else if(this.handshakeDone) {
      this.lastData = '';
      this.connected = true;
      this.emit('open', data.length ? data.substring(data.indexOf('{')) : data);
    }
  }
  if(nextFrame) {
    this.parseData(nextFrame);
  } else {
    this.lastData = data;
  }
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

/** Send message based on opcode type */
WebSocket.prototype.send = function (msg, opcode) {
  opcode = opcode === undefined ? 0x81 : opcode;
  var size = msg.length;
  if (msg.length>125) {
    size = 126;
  }
  this.socket.write(strChr(opcode, size + ( this.masking ? 128 : 0 )));
  
  if (size == 126) {
    // Need to write extra bytes for longer messages
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

WebSocket.prototype.close = function() {
  this.socket.end();
};

/** Create a WebSocket client */
exports = function (host, options) {
  var ws = new WebSocket(host, options);
  ws.initializeConnection();
  return ws;
};

/** Create a WebSocket server */
exports.createServer = function(callback, wscallback) {
  var server = require('http').createServer(function (req, res) {
    if (req.headers.Connection && req.headers.Connection.indexOf("Upgrade")>=0) {
      var key = req.headers["Sec-WebSocket-Key"];
      var accept = btoa(E.toString(crypto.SHA1(key+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11")));
      res.writeHead(101, {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Accept': accept,
          'Sec-WebSocket-Protocol': req.headers["Sec-WebSocket-Protocol"]
      });
      res.write(""); /** Completes the webSocket handshake on pre-1v85 builds **/

      var ws = new WebSocket(undefined, {});
      ws.socket = res;
      req.on('data', ws.parseData.bind(ws) );
      req.on('close', function() {
        // if srvPing is undefined, we already emitted a 'close'
        clearInterval(ws.srvPing);
        ws.srvPing = undefined;
        // emit websocket close event
        ws.emit('close');
      });
      /** Start a server ping at the keepAlive interval  **/
      ws.srvPing = setInterval(function () {
          ws.emit('ping', true); // true: indicates a server ping
          ws.send('ping', 0x89);
      }, ws.keepAlive);
      server.emit("websocket", ws);
    } else callback(req, res);
  });
  return server;
};
