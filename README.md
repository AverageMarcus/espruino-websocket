# espruino-websocket
Crude websocket implementation for use on an [Espruino](http://www.espruino.com/)

## About

A modified version of the current Espruino websocket module (https://github.com/espruino/EspruinoDocs/blob/master/modules/ws.js) that doesn't have the 127 chart limit and implements better websocket key hadling by using a slightly modified version of the SHA1 module from http://jumspruino.jumware.com/sources/ESP8266Test.js

## Example Usage

```js

var wifi = require("EspruinoWiFi");
var WebSocket = require('websocket');

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

Result:
```
Connected to WiFi!
Connected
Message Hello WebSocket!
```
