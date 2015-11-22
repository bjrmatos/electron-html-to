/* eslint no-var: [0] */

var util = require('util'),
    path = require('path'),
    fs = require('fs'),
    app = require('app'),
    renderer = require('ipc'),
    BrowserWindow = require('browser-window'),
    assign = require('object-assign'),
    pick = require('lodash.pick'),
    sliced = require('sliced'),
    registerProtocol = require('./registerProtocol'),
    conversionScript = require('./conversionScript'),
    evaluate = require('./evaluateJS'),
    parentChannel = require('../ipc')(process);

var mainWindow = null,
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
  var protocol = require('protocol');

  var evaluateInWindow,
      dataForWindow = {},
      browserWindowOpts,
      webPreferences;

  var browserWindowDefaults = {
    width: 600,
    height: 600
  };

  var webPreferencesDefaults = {
    'node-integration': false,
    javascript: true,
    'web-security': false
  };

  log('electron process ready..');

  registerProtocol(protocol, settingsData.allowLocalFilesAccess, log, function(registrationErr) {
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

    browserWindowOpts = pick(settingsData.browserWindow || {}, [
      'width',
      'height',
      'x',
      'y',
      'use-content-size',
      'web-preferences'
    ]);

    browserWindowOpts = assign({}, browserWindowDefaults, browserWindowOpts, {
      show: false
    });

    webPreferences = pick(browserWindowOpts['web-preferences'] || {}, [
      'node-integration',
      'partition',
      'zoom-factor',
      'javascript',
      'web-security',
      'allow-displaying-insecure-content',
      'allow-running-insecure-content',
      'images',
      'java',
      'webgl',
      'webaudio',
      'plugins',
      'experimental-features',
      'experimental-canvas-features',
      'overlay-scrollbars',
      'overlay-fullscreen-video',
      'shared-worker',
      'direct-write'
    ]);

    browserWindowOpts['web-preferences'] = assign({}, webPreferencesDefaults, webPreferences, {
      preload: path.join(__dirname, 'preload.js')
    });

    log('creating new browser window with options:', browserWindowOpts);

    if (browserWindowOpts.show) {
      log('browser window visibility activated');
    }

    mainWindow = new BrowserWindow(browserWindowOpts);

    evaluateInWindow = evaluate(mainWindow);
    global.windowsData[mainWindow.id] = dataForWindow;

    mainWindow.webContents.setAudioMuted(true);

    mainWindow.on('closed', function() {
      log('browser-window closed..');

      delete global.windowsData[mainWindow.id];
      mainWindow = null;
    });

    conversionScript(settingsData, mainWindow, evaluateInWindow, log, converter, respond);

    if (settingsData.userAgent) {
      log('setting up custom user agent: ' + settingsData.userAgent);
      mainWindow.webContents.setUserAgent(settingsData.userAgent);
    }

    log(util.format('loading url in browser window: %s', settingsData.url));

    mainWindow.loadUrl(settingsData.url);
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

  if (DEBUG_MODE) {
    // in debug mode, don't destroy the browser window
    mainWindow.show();
    // mainWindow.openDevTools();
  } else {
    log('destroying browser window..');
    mainWindow.destroy();
  }
}
