
const util = require('util'),
      http = require('http'),
      // disabling import rule because `electron` is a built-in module
      // eslint-disable-next-line import/no-unresolved
      electron = require('electron'),
      jsonBody = require('body/json'),
      sliced = require('sliced'),
      getBrowserWindowOpts = require('./getBrowserWindowOpts'),
      listenRequestsInPage = require('./listenRequestsInPage'),
      conversionScript = require('./conversionScript'),
      evaluate = require('./evaluateJS'),
      parentChannel = require('../ipc')(process),
      app = electron.app,
      renderer = electron.ipcMain,
      BrowserWindow = electron.BrowserWindow;

let windows = [],
    electronVersion,
    log,
    PORT,
    WORKER_ID,
    DEBUG_MODE,
    CHROME_COMMAND_LINE_SWITCHES,
    ALLOW_LOCAL_FILES_ACCESS,
    MAX_LOG_ENTRY_SIZE;

if (process.versions.electron) {
  electronVersion = process.versions.electron;
} else if (process.versions['atom-shell']) {
  electronVersion = process.versions['atom-shell'];
} else {
  electronVersion = '';
}

PORT = process.env.ELECTRON_WORKER_PORT;
WORKER_ID = process.env.ELECTRON_WORKER_ID;
DEBUG_MODE = Boolean(process.env.ELECTRON_HTML_TO_DEBUGGING);
CHROME_COMMAND_LINE_SWITCHES = JSON.parse(process.env.chromeCommandLineSwitches);
ALLOW_LOCAL_FILES_ACCESS = process.env.allowLocalFilesAccess === 'true';
MAX_LOG_ENTRY_SIZE = parseInt(process.env.maxLogEntrySize, 10);

if (isNaN(MAX_LOG_ENTRY_SIZE)) {
  MAX_LOG_ENTRY_SIZE = 1000;
}

log = function() {
  // eslint-disable-next-line prefer-rest-params
  let newArgs = sliced(arguments);

  newArgs.unshift(`[Worker ${WORKER_ID}]`);

  parentChannel.emit.apply(parentChannel, ['log'].concat(newArgs));
};

global.windowsData = {};
global.windowsLogs = {};

Object.keys(CHROME_COMMAND_LINE_SWITCHES).forEach((switchName) => {
  let switchValue = CHROME_COMMAND_LINE_SWITCHES[switchName];

  if (switchValue != null) {
    log(`establishing chrome command line switch [${switchName}:${switchValue}]`);
    app.commandLine.appendSwitch(switchName, switchValue);
  } else {
    log(`establishing chrome command line switch [${switchName}]`);
    app.commandLine.appendSwitch(switchName);
  }
});

if (app.dock && typeof app.dock.hide === 'function') {
  if (!DEBUG_MODE) {
    app.dock.hide();
  }
}

app.on('window-all-closed', () => {
  // by default dont close the app (because the electron server will be running)
  // only close when debug mode is on
  if (DEBUG_MODE) {
    app.quit();
  }
});

app.on('ready', () => {
  let server;

  log('electron process ready..');

  renderer.on('page-error', (ev, windowId, errMsg, errStack) => {
    // saving errors on page
    saveLogsInStore(global.windowsLogs[windowId], 'warn', `error in page: ${errMsg}`);

    saveLogsInStore(global.windowsLogs[windowId], 'warn', `error in page stack: ${errStack}`);

    parentChannel.emit('page-error', windowId, errMsg, errStack);
  });

  renderer.on('page-log', (ev, args) => {
    let windowId = args[0],
        logLevel = args[1],
        logArgs = args.slice(2),
        // removing log level argument
        newArgs = args.slice(0, 1).concat(logArgs);

    // saving logs
    saveLogsInStore(global.windowsLogs[windowId], logLevel, logArgs, true);

    parentChannel.emit.apply(parentChannel, ['page-log'].concat(newArgs));
  });

  renderer.on('log', function() {
    // eslint-disable-next-line prefer-rest-params
    let newArgs = sliced(arguments),
        windowId = newArgs.splice(0, 2)[1];

    newArgs.unshift(`[Browser window - ${windowId} log ]:`);

    log.apply(log, newArgs);
  });

  server = http.createServer((req, res) => {
    log('new request for electron-server..');
    log('parsing request body..');

    jsonBody(req, res, (err, settingsData) => {
      if (err) {
        // eslint-disable-next-line no-param-reassign
        res.statusCode = 500;
        return res.end(err.message);
      }

      log('request body parsed..');

      try {
        createBrowserWindow(res, settingsData);
      } catch (uncaughtErr) {
        // eslint-disable-next-line no-param-reassign
        res.statusCode = 500;
        res.end(uncaughtErr.message);
      }
    });
  });

  server.on('error', (serverErr) => {
    log(`an error in the server has ocurred: ${serverErr.message}`);
    app.quit();
  });

  // we don't bind the server to any specific hostname to allow listening
  // in any ip address in local server
  server.listen(PORT);
});

function createBrowserWindow(res, settingsData) {
  let evaluateInWindow,
      dataForWindow = {},
      browserWindowOpts,
      converterPath,
      converter,
      currentWindow,
      currentWindowId,
      extraHeaders = '';

  function respond(err, data) {
    let errMsg = null;

    log('finishing work in browser-window..');

    if (err) {
      errMsg = err.message;
      // eslint-disable-next-line no-param-reassign
      res.statusCode = 500;
      return res.end(errMsg);
    }

    if (settingsData.collectLogs) {
      // eslint-disable-next-line no-param-reassign
      data.logs = global.windowsLogs[currentWindowId];
    } else {
      // eslint-disable-next-line no-param-reassign
      data.logs = [];
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));

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

  log(`requiring converter module from ${converterPath}`);

  try {
    // eslint-disable-next-line global-require
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
  global.windowsLogs[currentWindowId] = [];

  saveLogsInStore(
    global.windowsLogs[currentWindowId],
    'debug',
    `Converting using electron-server strategy in electron ${electronVersion}`
  );

  currentWindow.webContents.setAudioMuted(true);

  listenRequestsInPage(
    currentWindow,
    {
      allowLocalFilesAccess: ALLOW_LOCAL_FILES_ACCESS,
      pageUrl: settingsData.url
    },
    log,
    saveLogsInStore(global.windowsLogs[currentWindowId])
  );

  currentWindow.on('closed', () => {
    log('browser-window closed..');

    delete global.windowsData[currentWindowId];
    delete global.windowsLogs[currentWindowId];

    removeWindow(currentWindow);
    currentWindow = null;
  });

  conversionScript(settingsData, currentWindow, evaluateInWindow, log, converter, respond);

  if (settingsData.userAgent) {
    log(`setting up custom user agent: ${settingsData.userAgent}`);
    currentWindow.webContents.setUserAgent(settingsData.userAgent);
  }

  if (typeof settingsData.extraHeaders === 'object') {
    Object.keys(settingsData.extraHeaders).forEach((key) => {
      extraHeaders += `${key}: ${settingsData.extraHeaders[key]}\n`;
    });
  }

  log(util.format('loading url in browser window: %s, with headers: %s', settingsData.url, extraHeaders));

  if (extraHeaders) {
    currentWindow.loadURL(settingsData.url, {
      extraHeaders
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
  windows.forEach((win, index) => {
    if (win === browserWindow) {
      windows.splice(index, 1);
    }
  });
}

function saveLogsInStore(store, level, msg, userLevel = false) {
  // eslint-disable-next-line prefer-rest-params
  let args = sliced(arguments);

  if (args.length === 1) {
    return _saveLogs.bind(undefined, store);
  }

  return _saveLogs(store, level, msg, userLevel);

  function _saveLogs(_store, _level, _msg, _userLevel) {
    const meta = {
      level: _level,
      message: trimMessage(_msg),
      timestamp: new Date().getTime()
    };

    if (_userLevel) {
      meta.userLevel = true;
    }

    _store.push(meta);
  }
}

function trimMessage(args) {
  let message = args;

  if (Array.isArray(args)) {
    message = args.join(' ');
  }

  if (message.length > MAX_LOG_ENTRY_SIZE) {
    return `${message.substring(0, MAX_LOG_ENTRY_SIZE)}...`;
  }

  return message;
}
