/* eslint no-var: [0] */

var util = require('util'),
    fs = require('fs'),
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

var mainWindow = null,
    mainWindowId,
    settingsFile,
    settingsData,
    converterPath,
    converter,
    log,
    WORKER_ID,
    DEBUG_MODE;

settingsFile = process.env.ELECTRON_HTML_TO_SETTINGS_FILE_PATH;
WORKER_ID = process.env.ELECTRON_WORKER_ID;
DEBUG_MODE = Boolean(process.env.ELECTRON_HTML_TO_DEBUGGING);

log = function() {
  var newArgs = sliced(arguments);

  newArgs.unshift('[Worker ' + WORKER_ID + ']');

  parentChannel.emit.apply(parentChannel, ['log'].concat(newArgs));
};

global.windowsData = {};

log('reading settings file from ' + settingsFile);
settingsData = fs.readFileSync(settingsFile).toString();

settingsData = JSON.parse(settingsData);
converterPath = settingsData.converterPath;

log('requiring converter module from ' + converterPath);
converter = require(converterPath);

Object.keys(settingsData.chromeCommandLineSwitches).forEach(function(switchName) {
  var switchValue = settingsData.chromeCommandLineSwitches[switchName];

  if (switchValue != null) {
    log('establishing chrome command line switch [' + switchName + ':' + switchValue + ']');
    app.commandLine.appendSwitch(switchName, switchValue);
  } else {
    log('establishing chrome command line switch [' + switchName + ']');
    app.commandLine.appendSwitch(switchName);
  }
});

app.on('window-all-closed', function() {
  log('exiting electron process..');
  app.quit();
});

if (app.dock && typeof app.dock.hide === 'function') {
  if (!DEBUG_MODE) {
    app.dock.hide();
  }
}

app.on('ready', function() {
  var protocol = electron.protocol;

  var evaluateInWindow,
      dataForWindow = {},
      browserWindowOpts;

  log('electron process ready..');

  registerProtocol(protocol, settingsData.allowLocalFilesAccess, log, function(registrationErr) {
    var extraHeaders = '';

    if (registrationErr) {
      return respond(registrationErr);
    }

    if (settingsData.waitForJS) {
      log('waitForJS enabled..');

      dataForWindow.waitForJS = settingsData.waitForJS;
      dataForWindow.waitForJSVarName = settingsData.waitForJSVarName;
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

    // get browser window options with defaults
    browserWindowOpts = getBrowserWindowOpts(settingsData.browserWindow);

    log('creating new browser window with options:', browserWindowOpts);

    if (DEBUG_MODE) {
      browserWindowOpts.show = true;
    }

    if (browserWindowOpts.show) {
      log('browser window visibility activated');
    }

    mainWindow = new BrowserWindow(browserWindowOpts);
    mainWindowId = mainWindow.id;

    evaluateInWindow = evaluate(mainWindow);
    global.windowsData[mainWindowId] = dataForWindow;

    mainWindow.webContents.setAudioMuted(true);

    mainWindow.on('closed', function() {
      log('browser-window closed..');

      delete global.windowsData[mainWindowId];
      mainWindow = null;
    });

    conversionScript(settingsData, mainWindow, evaluateInWindow, log, converter, respond);

    if (settingsData.userAgent) {
      log('setting up custom user agent: ' + settingsData.userAgent);
      mainWindow.webContents.setUserAgent(settingsData.userAgent);
    }

    if (typeof settingsData.extraHeaders === 'object') {
      Object.keys(settingsData.extraHeaders).forEach(function(key) {
        extraHeaders += key + ': ' + settingsData.extraHeaders[key] + '\n';
      });
    }

    log(util.format('loading url in browser window: %s, with headers: %s', settingsData.url, extraHeaders));

    if (extraHeaders) {
      mainWindow.loadURL(settingsData.url, {
        extraHeaders: extraHeaders
      });
    } else {
      mainWindow.loadURL(settingsData.url);
    }

    // useful in windows to prevent the electron process to hang..
    mainWindow.focus();
  });
});

function respond(err, data) {
  var errMsg = null;

  log('finishing work in browser-window..');

  if (err) {
    errMsg = err.message;
  }

  parentChannel.emit('finish', errMsg, data);

  if (!mainWindow) {
    return;
  }

  // in debug mode, don't destroy the browser window
  if (!DEBUG_MODE) {
    log('destroying browser window..');
    mainWindow.destroy();
  }
}
