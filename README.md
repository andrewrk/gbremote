# gbremote

[Groove Basin](https://github.com/andrewrk/groovebasin) command-line remote
control and Node.js module.

This project also serves as an example for writing a Groove Basin client using
the [Groove Basin Protocol Specification](https://github.com/andrewrk/groovebasin/blob/master/doc/protocol.md).

## Command Line Interface

```
Usage: node /home/andy/dev/gbremote/cli.js command [args]
Options With Defaults:
  --server http://127.0.0.1:16242/
Commands:
  help
  toggle
  pause
  play
  stop
  next
  prev
  status
  stream
```

## Module Synopsis

```js
var gbremote = require('gbremote');
var url = require('url');
var gbr = gbremote.createClient(url.parse("http://127.0.0.1:16242"));
gbr.on('connect', function() {
  gbr.sendMessage("play");
  gbr.close();
});
gbr.connect();
```

## API Documentation

### gbremote.createClient(options)

Creates a `GrooveBasinRemote` instance.

`options`:

 * `protocol`: (optional) One of: `ws:`, `wss:`, `http:`, `https:`. Defaults to
   `http:`. It doesn't matter whether you use ws or http, it's just
   distinguishing between secure and non-secure.
 * `hostname`: (optional) Defaults to 127.0.0.1.
 * `port`: (optional) Defaults to 16242.

### gbremote.GrooveBasinRemote

#### gbr.connect

#### gbr.close

#### gbr.sendMessage(name, args)

#### gbr.httpRequest

#### Event: 'error'

`function (err) { }`

#### Event: 'connect'

#### Event: 'close'

#### Event: 'message'

`function (name, args) { }`
