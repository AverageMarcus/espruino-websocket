# espruino-websocket
Websocket implementation for use on an [Espruino](http://www.espruino.com/)

## About

A modified version of the current Espruino websocket module (https://github.com/espruino/EspruinoDocs/blob/master/modules/ws.js) hosted here until these changes are accepted into the main repo.

## Improvements
* Correctly handles connection upgrade without closing connection
* Allows sending messages longer than 127 chars
* Correctly generated a random Sec-WebSocket-Key
* Adds ability for connecting to a websocket on a subdirectory by passing in the path
* Added function to close websocket
* Handle packets that contain multiple frames

## How to use

```js
var WebSocket = require("https://github.com/AverageMarcus/espruino-websocket/blob/master/websocket.js");
var wifi = require("EspruinoWiFi");

function onInit() {
  wifi.connect(WIFI_NAME, WIFI_OPTIONS, function(err) {
    if (err) {
      return console.log("Connection error: "+err);
    }

    console.log("Connected to WiFi!");

    var ws = new WebSocket('echo.websocket.org');

    ws.on('open', function(msg) {
      console.log('Connected', msg);
      ws.send('Hello WebSocket!');
    });

    ws.on('message', function(msg) {
      console.log('Message', msg);
    });
  });
}

onInit();
```
