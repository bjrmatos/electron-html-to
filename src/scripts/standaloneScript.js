
const util = require('util'),
      fs = require('fs'),
      // disabling import rule because `electron` is a built-in module
      // eslint-disable-next-line import/no-unresolved
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

let mainWindow = null,
    mainWindowId,
    settingsFile,
    settingsData,
    converterPath,
    converter,
    maxLogEntrySize,
    log,
    windowLogs = [],
    WORKER_ID,
    DEBUG_MODE;

settingsFile = process.env.ELECTRON_HTML_TO_SETTINGS_FILE_PATH;
WORKER_ID = process.env.ELECTRON_WORKER_ID;
DEBUG_MODE = Boolean(process.env.ELECTRON_HTML_TO_DEBUGGING);

log = function() {
  // eslint-disable-next-line prefer-rest-params
  let newArgs = sliced(arguments);

  newArgs.unshift(`[Worker ${WORKER_ID}]`);

  parentChannel.emit.apply(parentChannel, ['log'].concat(newArgs));
};

global.windowsData = {};

log(`reading settings file from ${settingsFile}`);
settingsData = fs.readFileSync(settingsFile).toString();

settingsData = JSON.parse(settingsData);
converterPath = settingsData.converterPath;
maxLogEntrySize = parseInt(settingsData.maxLogEntrySize, 10);

if (isNaN(maxLogEntrySize)) {
  maxLogEntrySize = 1000;
}

log(`requiring converter module from ${converterPath}`);
converter = require(converterPath);

Object.keys(settingsData.chromeCommandLineSwitches).forEach((switchName) => {
  let switchValue = settingsData.chromeCommandLineSwitches[switchName];

  if (switchValue != null) {
    log(`establishing chrome command line switch [${switchName}:${switchValue}]`);
    app.commandLine.appendSwitch(switchName, switchValue);
  } else {
    log(`establishing chrome command line switch [${switchName}]`);
    app.commandLine.appendSwitch(switchName);
  }
});

app.on('window-all-closed', () => {
  log('exiting electron process..');
  app.quit();
});

if (app.dock && typeof app.dock.hide === 'function') {
  if (!DEBUG_MODE) {
    app.dock.hide();
  }
}

app.on('ready', () => {
  let protocol = electron.protocol;

  let evaluateInWindow,
      dataForWindow = {},
      browserWindowOpts;

  log('electron process ready..');

  registerProtocol(protocol, settingsData.allowLocalFilesAccess, log, (registrationErr) => {
    let extraHeaders = '';

    if (registrationErr) {
      return respond(registrationErr);
    }

    if (settingsData.waitForJS) {
      log('waitForJS enabled..');

      dataForWindow.waitForJS = settingsData.waitForJS;
      dataForWindow.waitForJSVarName = settingsData.waitForJSVarName;
    }

    renderer.on('page-error', (ev, windowId, errMsg, errStack) => {
      parentChannel.emit('page-error', windowId, errMsg, errStack);
    });

    renderer.on('page-log', (ev, args) => {
      let logLevel = args[1],
          logArgs = args.slice(2),
          // removing log level argument
          newArgs = args.slice(0, 1).concat(logArgs);

      // saving logs
      windowLogs.push({
        level: logLevel,
        message: trimMessage(logArgs),
        timestamp: new Date().getTime()
      });

      parentChannel.emit.apply(parentChannel, ['page-log'].concat(newArgs));
    });

    renderer.on('log', function() {
      // eslint-disable-next-line prefer-rest-params
      let newArgs = sliced(arguments),
          windowId = newArgs.splice(0, 2)[1];

      newArgs.unshift(`[Browser window - ${windowId} log ]:`);

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

    mainWindow.on('closed', () => {
      log('browser-window closed..');

      delete global.windowsData[mainWindowId];
      mainWindow = null;
    });

    conversionScript(settingsData, mainWindow, evaluateInWindow, log, converter, respond);

    if (settingsData.userAgent) {
      log(`setting up custom user agent: ${settingsData.userAgent}`);
      mainWindow.webContents.setUserAgent(settingsData.userAgent);
    }

    if (typeof settingsData.extraHeaders === 'object') {
      Object.keys(settingsData.extraHeaders).forEach((key) => {
        extraHeaders += `${key}: ${settingsData.extraHeaders[key]}\n`;
      });
    }

    log(util.format('loading url in browser window: %s, with headers: %s', settingsData.url, extraHeaders));

    if (extraHeaders) {
      mainWindow.loadURL(settingsData.url, {
        extraHeaders
      });
    } else {
      mainWindow.loadURL(settingsData.url);
    }

    // useful in windows to prevent the electron process to hang..
    mainWindow.focus();
  });
});

function respond(err, data) {
  let errMsg = null;

  log('finishing work in browser-window..');

  if (err) {
    errMsg = err.message;
  }

  if (settingsData.collectLogs) {
    // eslint-disable-next-line no-param-reassign
    data.logs = windowLogs;
  } else {
    // eslint-disable-next-line no-param-reassign
    data.logs = [];
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

function trimMessage(args) {
  let message = args.join(' ');

  if (message.length > maxLogEntrySize) {
    return `${message.substring(0, maxLogEntrySize)}...`;
  }

  return message;
}
