
import path from 'path';
import fs from 'fs';
import debug from 'debug';
import electronWorkers from 'electron-workers';
import ensureStart from './ensureStartWorker';
import { name as pkgName } from '../package.json';

const debugServerStrategy = debug(`${pkgName}:electron-server-strategy`),
      debugIpcStrategy = debug(`${pkgName}:electron-ipc-strategy`);

export default function(mode, options) {
  let debugMode = false,
      scriptPath,
      debugStrategy;

  if (mode === 'server') {
    scriptPath = path.join(__dirname, 'scripts', 'serverScript.js');
    debugStrategy = debugServerStrategy;
  } else if (mode === 'ipc') {
    scriptPath = path.join(__dirname, 'scripts', 'ipcScript.js');
    debugStrategy = debugIpcStrategy;
  } else {
    // defaults to server script and a no-op function
    scriptPath = path.join(__dirname, 'scripts', 'serverScript.js');
    debugStrategy = () => {};
  }

  const workersOptions = { ...options, pathToScript: scriptPath, env: {} };

  if (mode) {
    workersOptions.connectionMode = mode;
  }

  if (process.env.ELECTRON_HTML_TO_DEBUGGING !== undefined) {
    debugMode = true;
    workersOptions.env.ELECTRON_HTML_TO_DEBUGGING = process.env.ELECTRON_HTML_TO_DEBUGGING;
  }

  if (process.env.IISNODE_VERSION !== undefined) {
    workersOptions.env.IISNODE_VERSION = process.env.IISNODE_VERSION;
  }

  workersOptions.env.chromeCommandLineSwitches = JSON.stringify(options.chromeCommandLineSwitches || {});
  workersOptions.env.allowLocalFilesAccess = JSON.stringify(options.allowLocalFilesAccess || false);

  workersOptions.stdio = [null, null, null, 'ipc'];

  if (debugMode) {
    workersOptions.stdio = [null, process.stdout, process.stderr, 'ipc'];
  }

  workersOptions.killSignal = 'SIGKILL';

  const workers = electronWorkers(workersOptions);

  function serverIpcStrategyCall(requestOptions, converterPath, id, cb) {
    let executeOpts = {};

    if (debugMode) {
      debugStrategy('electron process debugging mode activated');
    }

    if (process.env.IISNODE_VERSION !== undefined) {
      debugStrategy('running in IISNODE..');
    }

    debugStrategy('checking if electron workers have started..');

    ensureStart(debugStrategy, workers, serverIpcStrategyCall, (err) => {
      if (err) {
        debugStrategy('electron workers could not start..');
        debugStrategy('conversion ended with error..');
        return cb(err);
      }

      debugStrategy('processing conversion..');

      if (requestOptions.timeout != null) {
        executeOpts.timeout = requestOptions.timeout;
      }

      workers.execute({ ...requestOptions, converterPath }, executeOpts, (executeErr, res) => {
        if (executeErr) {
          debugStrategy('conversion ended with error..');

          // if the error is a timeout from electron-workers
          if (executeErr.workerTimeout) {
            // eslint-disable-next-line no-param-reassign
            executeErr.electronTimeout = true;
          }

          return cb(executeErr);
        }

        let { output, ...restData } = res;

        debugStrategy('conversion ended successfully..');

        // disabling no-undef rule because eslint don't detect object rest spread correctly
        /* eslint-disable no-undef */
        cb(null, {
          ...restData,
          stream: fs.createReadStream(output)
        });
        /* eslint-enable no-undef */
      });
    });
  }

  serverIpcStrategyCall.startCb = [];

  serverIpcStrategyCall.kill = () => {
    if (!serverIpcStrategyCall.started) {
      return;
    }

    debugStrategy('killing electron workers..');

    serverIpcStrategyCall.started = false;
    serverIpcStrategyCall.startCb = [];
    workers.kill();
  };

  return serverIpcStrategyCall;
}
