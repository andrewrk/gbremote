#!/usr/bin/env node
var gbremote = require('./');
var url = require('url');

var cmdInfoTable = {
  help: usage,
  toggle: togglePlayback,
  pause: pause,
  play: play,
  stop: stop,
  next: seekNext,
  prev: seekPrev,
  'status': showStatus,
  stream: stream,
  importurl: importUrl,
};

main(process.argv[0] + " " + process.argv[1], process.argv.slice(2));

function usage(arg0) {
  console.error("Usage: " + arg0 + " [options] command [args]");
  console.error("Options With Defaults:");
  console.error("  --server http://127.0.0.1:16242/");
  console.error("Commands:");
  for (var cmd in cmdInfoTable) {
    console.error("  " + cmd);
  }
  process.exit(1);
}

function main(arg0, args) {
  if (args.length < 1) return usage(arg0);
  var cmd = args[0];
  var cmdInfo = cmdInfoTable[cmd];
  if (!cmdInfo) {
    console.error("Unknown command: " + cmd);
    return usage(arg0);
  }
  var o = {
    server: "http://127.0.0.1:16242/",
  };
  var remainingArgs = [];
  for (var i = 1; i < args.length; i += 1) {
    var arg = args[i];
    if (/^--/.test(arg)) {
      if (i + 1 >= args.length) {
        return usage(arg0);
      } else {
        i += 1;
        if (arg === "--server") {
          o.server = args[i];
        } else {
          return usage(arg0);
        }
      }
    } else {
      remainingArgs.push(arg);
    }
  }
  cmdInfo(arg0, o, remainingArgs);
}

function createClient(flags) {
  var o = url.parse(flags.server);
  var gbr = gbremote.createClient(o);
  gbr.on('error', function(err) {
    throw err;
  });
  return gbr;
}

function noargs(arg0, args) {
  if (args.length > 0) return usage(arg0);
}

function togglePlayback(arg0, flags, args) {
  noargs(arg0, args);
  var gbr = createClient(flags);
  var currentTrack;
  gbr.on('connect', function() {
    gbr.sendMessage('subscribe', {name: 'currentTrack'});
  });
  gbr.on('message', function(name, args) {
    if (name === 'currentTrack') {
      currentTrack = args;
      doit();
    }
  });
  gbr.connect();

  function doit() {
    if (currentTrack.isPlaying) {
      gbr.sendMessage("pause");
    } else {
      gbr.sendMessage("play");
    }
    gbr.close();
  }
}

function play(arg0, flags, args) {
  return singleMessage(arg0, flags, args, "play");
}

function pause(arg0, flags, args) {
  return singleMessage(arg0, flags, args, "pause");
}

function stop(arg0, flags, args) {
  return singleMessage(arg0, flags, args, "stop");
}

function singleMessage(arg0, flags, args, msgName) {
  noargs(arg0, args);
  var gbr = createClient(flags);
  gbr.on('connect', function() {
    gbr.sendMessage(msgName);
    gbr.close();
  });
  gbr.connect();
}

function seekNext(arg0, flags, args) {
  return seekDir(arg0, flags, args, 1);
}

function seekPrev(arg0, flags, args) {
  return seekDir(arg0, flags, args, -1);
}

function seekDir(arg0, flags, args, dir) {
  noargs(arg0, args);
  var gbr = createClient(flags);
  var queue, currentTrack;
  gbr.on('connect', function() {
    gbr.sendMessage('subscribe', {name: 'queue'});
    gbr.sendMessage('subscribe', {name: 'currentTrack'});
  });
  gbr.on('message', function(name, args) {
    if (name === 'queue') {
      queue = args;
    } else if (name === 'currentTrack') {
      currentTrack = args;
      doit();
    }
  });
  gbr.connect();

  function doit() {
    var queueItems = [];
    var queueItem;
    for (var itemId in queue) {
      queueItem = queue[itemId];
      queueItem.id = itemId;
      queueItems.push(queueItem);
    }
    queueItems.sort(compareSortKeyThenId);

    var currentIndex = null;
    for (var i = 0; i < queueItems.length; i += 1) {
      queueItem = queueItems[i];
      if (queueItem.id === currentTrack.currentItemId) {
        currentIndex = i;
        break;
      }
    }
    if (currentIndex == null) currentIndex = 0;

    var newIndex = currentIndex + dir;

    newIndex = Math.max(newIndex, 0);
    newIndex = Math.min(newIndex, queueItems.length - 1);

    gbr.sendMessage('seek', {
      id: queueItems[newIndex].id,
      pos: 0,
    });
    gbr.close();
  }
}

function showStatus(arg0, flags, args) {
  noargs(arg0, args);
  var gbr = createClient(flags);
  var library, queue, currentTrack, serverTimeOffset;
  gbr.on('connect', function() {
    gbr.sendMessage('subscribe', {name: 'libraryQueue'});
    gbr.sendMessage('subscribe', {name: 'queue'});
    gbr.sendMessage('subscribe', {name: 'currentTrack'});
  });
  gbr.on('message', function(name, args) {
    if (name === 'time') {
      serverTimeOffset = new Date(args) - new Date();
    } else if (name === 'libraryQueue') {
      library = args;
    } else if (name === 'queue') {
      queue = args;
    } else if (name === 'currentTrack') {
      currentTrack = args;
      doit();
    }
  });
  gbr.connect();

  function doit() {
    if (currentTrack.currentItemId) {
      var queueItem = queue[currentTrack.currentItemId];
      var libraryItem = library[queueItem.key];
      if (currentTrack.isPlaying) {
        var trackStartDate = new Date(new Date(currentTrack.trackStartDate) - serverTimeOffset);
        var pos = (new Date() - trackStartDate) / 1000;
        console.log("Playing: " + formatTime(pos) + " / " + formatTime(libraryItem.duration));
      } else {
        console.log("Paused: " + formatTime(currentTrack.pausedTime) + " / " + formatTime(libraryItem.duration));
      }
      console.log("Current item: " + libraryItem.artistName + " - " + libraryItem.name);
    } else {
      console.log("Stopped");
    }
    gbr.close();
  }
}

function stream(arg0, flags, args) {
  noargs(arg0, args);
  var gbr = createClient(flags);
  var streamEndpoint;
  gbr.on('connect', function() {
    gbr.sendMessage('subscribe', {name: 'streamEndpoint'});
    gbr.sendMessage('setStreaming', true);
    gbr.sendMessage('play');
  });
  gbr.on('message', function(name, args) {
    if (name === 'streamEndpoint') {
      streamEndpoint = args;
      doit();
    }
  });
  gbr.connect();

  function doit() {
    var request = gbr.httpRequest({
      method: 'get',
      path: '/' + streamEndpoint,
    }, function(resp) {
      resp.pipe(process.stdout);
    });
    request.end();
  }
}

function importUrl(arg0, flags, args) {
  if (args.length !== 1) return usage(arg0);
  var theUrl = args[0];

  var gbr = createClient(flags);
  gbr.on('connect', function() {
    gbr.sendMessage("importUrl", {
      url: theUrl,
      autoQueue: true,
    });
    gbr.close();
  });
  gbr.connect();
}

function compareSortKeyThenId(a, b) {
  if (a.sortKey < b.sortKey) {
    return -1;
  } else if (a.sortKey > b.sortKey) {
    return 1;
  } else if (a.id < b.id) {
    return -1;
  } else if (a.id > b.id) {
    return 1;
  } else {
    return 0;
  }
}

function formatTime(seconds) {
  if (seconds == null) return "";
  var sign = "";
  if (seconds < 0) {
    sign = "-";
    seconds = -seconds;
  }
  seconds = Math.floor(seconds);
  var minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  var hours = Math.floor(minutes / 60);
  minutes -= hours * 60;
  if (hours !== 0) {
    return sign + hours + ":" + zfill(minutes, 2) + ":" + zfill(seconds, 2);
  } else {
    return sign + minutes + ":" + zfill(seconds, 2);
  }
}

function zfill(number, size) {
  number = String(number);
  while (number.length < size) number = "0" + number;
  return number;
}
