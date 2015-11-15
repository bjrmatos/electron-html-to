
import path from 'path';
import fs from 'fs';
import childProcess from 'child_process';
import debug from 'debug';
import which from 'which';
import sliced from 'sliced';
import ipc from './ipc';
import saveFile from './saveFile';
import { name as pkgName } from '../package.json';

const debugStrategy = debug(pkgName + ':dedicated-process-strategy'),
      debugElectronLog = debug(pkgName + ':electron-log'),
      debugPage = debug(pkgName + ':page');

let ELECTRON_PATH;

function getElectronPath() {
  let electron;

  if (ELECTRON_PATH) {
    debugStrategy('electron executable path returned from memory: %s', ELECTRON_PATH);
    return ELECTRON_PATH;
  }

  try {
    // first try to find the electron executable if it is installed from electron-prebuilt..
    electron = require('electron-prebuilt');
    debugStrategy('electron executable path returned from electron-prebuilt module: %s', electron);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      // ..if electron-prebuilt was not used try using which module
      electron = which.sync('electron');
      debugStrategy('electron executable path returned from $PATH: %s', electron);
    } else {
      throw err;
    }
  }

  ELECTRON_PATH = electron;

  return electron;
}

export default function(options, requestOptions, converterPath, id, cb) {
  const {
    tmpDir,
    timeout,
    pathToElectron
  } = options;

  const settingsFilePath = path.resolve(path.join(tmpDir, id + 'settings.html'));

  debugStrategy('saving settings in temporal file..');

  saveFile(tmpDir, settingsFilePath, JSON.stringify(requestOptions), (saveFileErr) => {
    const childArgs = [];

    let debugMode = false,
        isDone = false,
        electronPath,
        childOpts,
        child,
        childIpc,
        timeoutId;

    if (saveFileErr) {
      return cb(saveFileErr);
    }

    childArgs.push(path.join(__dirname, 'scripts', 'standaloneScript.js'));

    childOpts = {
      env: {
        ELECTRON_WORKER_ID: id,
        ELECTRON_HTML_TO_SETTINGS_FILE_PATH: settingsFilePath,
        ELECTRON_HTML_TO_CONVERTER_PATH: converterPath
      },
      stdio: [null, null, null, 'ipc']
    };

    debugStrategy('searching electron executable path..');

    if (pathToElectron) {
      debugStrategy('using electron executable path from custom location: %s', pathToElectron);
    }

    electronPath = pathToElectron || getElectronPath();

    if (process.env.ELECTRON_HTML_TO_DEBUGGING !== undefined) {
      debugStrategy('electron process debugging mode activated');
      debugMode = true;
      childOpts.env.ELECTRON_HTML_TO_DEBUGGING = process.env.ELECTRON_HTML_TO_DEBUGGING;
    }

    debugStrategy('spawing new electron process..');
    debugStrategy('processing conversion..');

    child = childProcess.spawn(electronPath, childArgs, childOpts);
    childIpc = ipc(child);

    child.stderr.on('data', (errData) => {
      isDone = true;

      debugStrategy('electron process has an error..');

      cb(new Error(errData.toString()));
      clearTimeout(timeoutId);

      if (child.connected) {
        child.disconnect();
      }

      child.kill();
    });

    childIpc.on('page-error', (windowId, errMsg, errStack) => {
      debugPage('An error has ocurred in browser window [%s]: message: %s stack: %s', windowId, errMsg, errStack);
    });

    childIpc.on('page-log', function() {
      let newArgs = sliced(arguments),
          windowId = newArgs.splice(0, 1);

      newArgs.unshift('console log from browser window [' + windowId + ']:');
      debugPage.apply(debugPage, newArgs);
    });

    childIpc.on('log', function() {
      debugElectronLog.apply(debugElectronLog, sliced(arguments));
    });

    childIpc.once('finish', (err, childData) => {
      if (isDone) {
        return;
      }

      isDone = true;
      clearTimeout(timeoutId);

      if (err) {
        debugStrategy('conversion ended with error..');
        cb(new Error(err));
      } else {
        let { output, ...restData } = childData;

        debugStrategy('conversion ended successfully..');

        cb(null, {
          ...restData,
          stream: fs.createReadStream(output)
        });
      }

      if (debugMode) {
        setTimeout(function() {
          if (child.connected) {
            child.disconnect();
          }

          child.kill();
        }, 4000);
      } else {
        if (child.connected) {
          child.disconnect();
        }

        child.kill();
      }
    });

    timeoutId = setTimeout(() => {
      let timeoutErr;

      if (isDone) {
        return;
      }

      debugStrategy('conversion timeout..');

      isDone = true;
      timeoutErr = new Error('Timeout when executing in electron');
      timeoutErr.electronTimeout = true;

      cb(timeoutErr);

      if (child.connected) {
        child.disconnect();
      }

      child.kill();
    }, requestOptions.timeout || timeout);
  });
}
