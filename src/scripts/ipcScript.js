/* eslint no-var: [0] */

var util = require('util'),
    electron = require('electron'),
    sliced = require('sliced'),
    getBrowserWindowOpts = require('./getBrowserWindowOpts'),
    registerProtocol = require('./registerProtocol'),
    conversionScript = require('./conversionScript'),
    evaluate = require('./evaluateJS'),
    parentChannel = require('../ipc')(process),
    app = electron.app,
    renderer = electron.ipcMain,
    BrowserWindow = electron.BrowserWindow;

var windows = [],
    log,
    WORKER_ID,
    DEBUG_MODE,
    CHROME_COMMAND_LINE_SWITCHES,
    ALLOW_LOCAL_FILES_ACCESS;

WORKER_ID = process.env.ELECTRON_WORKER_ID;
DEBUG_MODE = Boolean(process.env.ELECTRON_HTML_TO_DEBUGGING);
CHROME_COMMAND_LINE_SWITCHES = JSON.parse(process.env.chromeCommandLineSwitches);
ALLOW_LOCAL_FILES_ACCESS = process.env.allowLocalFilesAccess === 'true';

log = function() {
  var newArgs = sliced(arguments);

  newArgs.unshift('[Worker ' + WORKER_ID + ']');

  parentChannel.emit.apply(parentChannel, ['log'].concat(newArgs));
};

global.windowsData = {};

Object.keys(CHROME_COMMAND_LINE_SWITCHES).forEach(function(switchName) {
  var switchValue = CHROME_COMMAND_LINE_SWITCHES[switchName];

  if (switchValue != null) {
    log('establishing chrome command line switch [' + switchName + ':' + switchValue + ']');
    app.commandLine.appendSwitch(switchName, switchValue);
  } else {
    log('establishing chrome command line switch [' + switchName + ']');
    app.commandLine.appendSwitch(switchName);
  }
});

if (app.dock && typeof app.dock.hide === 'function') {
  if (!DEBUG_MODE) {
    app.dock.hide();
  }
}

app.on('window-all-closed', function() {
  // by default dont close the app (because the electron ipc will be running)
  // only close when debug mode is on
  if (DEBUG_MODE) {
    app.quit();
  }
});

app.on('ready', function() {
  var protocol = electron.protocol;

  log('electron process ready..');

  registerProtocol(protocol, ALLOW_LOCAL_FILES_ACCESS, log, function(registrationErr) {
    if (registrationErr) {
      return app.quit();
    }

    renderer.on('page-error', function(ev, windowId, errMsg, errStack) {
      parentChannel.emit('page-error', windowId, errMsg, errStack);
    });

    renderer.on('page-log', function(ev, args) {
      parentChannel.emit.apply(parentChannel, ['page-log'].concat(args));
    });

    renderer.on('log', function() {
      var newArgs = sliced(arguments),
          windowId = newArgs.splice(0, 2)[1];

      newArgs.unshift('[Browser window - ' + windowId + ' log ]:');

      log.apply(log, newArgs);
    });

    // communication with electron-workers ipc
    process.on('message', function(data) {
      if (!data) {
        return;
      }

      function respondIpc(err, payload) {
        var msg = {
          workerEvent: 'taskResponse',
          taskId: data.taskId
        };

        if (err) {
          msg.error = err;
        } else {
          msg.response = payload;
        }

        process.send(msg);
      }

      if (data.workerEvent === 'ping') {
        process.send({ workerEvent: 'pong' });
      } else if (data.workerEvent === 'task') {
        log('new task for electron-ipc..');

        try {
          createBrowserWindow(respondIpc, data.payload);
        } catch (uncaughtErr) {
          respondIpc(uncaughtErr);
        }
      }
    });
  });
});

function createBrowserWindow(respondIpc, settingsData) {
  var evaluateInWindow,
      dataForWindow = {},
      browserWindowOpts,
      converterPath,
      converter,
      currentWindow,
      currentWindowId,
      extraHeaders = '';

  function respond(err, data) {
    log('finishing work in browser-window..');

    if (err) {
      return respondIpc(err);
    }

    respondIpc(null, data);

    if (!currentWindow) {
      return;
    }

    // in debug mode, don't destroy the browser window
    if (!DEBUG_MODE) {
      log('destroying browser window..');
      currentWindow.destroy();
    }
  }

  converterPath = settingsData.converterPath;

  log('requiring converter module from ' + converterPath);

  try {
    converter = require(converterPath);
  } catch (requireErr) {
    return respond(requireErr);
  }

  if (settingsData.waitForJS) {
    log('waitForJS enabled..');

    dataForWindow.waitForJS = settingsData.waitForJS;
    dataForWindow.waitForJSVarName = settingsData.waitForJSVarName;
  }

  // get browser window options with defaults
  browserWindowOpts = getBrowserWindowOpts(settingsData.browserWindow);

  log('creating new browser window with options:', browserWindowOpts);

  if (DEBUG_MODE) {
    browserWindowOpts.show = true;
  }

  if (browserWindowOpts.show) {
    log('browser window visibility activated');
  }

  currentWindow = new BrowserWindow(browserWindowOpts);
  currentWindowId = currentWindow.id;
  addWindow(currentWindow);

  evaluateInWindow = evaluate(currentWindow);
  global.windowsData[currentWindowId] = dataForWindow;

  currentWindow.webContents.setAudioMuted(true);

  currentWindow.on('closed', function() {
    log('browser-window closed..');

    delete global.windowsData[currentWindowId];
    removeWindow(currentWindow);
    currentWindow = null;
  });

  conversionScript(settingsData, currentWindow, evaluateInWindow, log, converter, respond);

  if (settingsData.userAgent) {
    log('setting up custom user agent: ' + settingsData.userAgent);
    currentWindow.webContents.setUserAgent(settingsData.userAgent);
  }

  if (typeof settingsData.extraHeaders === 'object') {
    Object.keys(settingsData.extraHeaders).forEach(function(key) {
      extraHeaders += key + ': ' + settingsData.extraHeaders[key] + '\n';
    });
  }

  log(util.format('loading url in browser window: %s, with headers: %s', settingsData.url, extraHeaders));

  if (extraHeaders) {
    currentWindow.loadURL(settingsData.url, {
      extraHeaders: extraHeaders
    });
  } else {
    currentWindow.loadURL(settingsData.url);
  }

  // useful in windows to prevent the electron process to hang..
  currentWindow.focus();
}

function addWindow(browserWindow) {
  windows.push(browserWindow);
}

function removeWindow(browserWindow) {
  windows.forEach(function(win, index) {
    if (win === browserWindow) {
      windows.splice(index, 1);
    }
  });
}
