
import path from 'path';
import fs from 'fs';
import debug from 'debug';
import sliced from 'sliced';
import electronWorkers from 'electron-workers';
import ipc from './ipc';
import { name as pkgName } from '../package.json';

const SEVER_SCRIPT_PATH = path.join(__dirname, 'scripts', 'serverScript.js'),
      debugStrategy = debug(pkgName + ':electron-server-strategy'),
      debugElectronLog = debug(pkgName + ':electron-log'),
      debugPage = debug(pkgName + ':page');

function ensureStart(workers, instance, cb) {
  if (instance.started) {
    return cb();
  }

  instance.startCb.push(cb);

  if (instance.starting) {
    return;
  }

  debugStrategy('starting electron workers..');

  instance.starting = true;

  workers.on('workerProcessCreated', (worker, workerProcess) => {
    listenLog(worker, workerProcess);
  });

  workers.start((startErr) => {
    instance.starting = false;

    if (startErr) {
      instance.startCb.forEach((callback) => callback(startErr) );
      return;
    }

    debugStrategy('electron workers started successfully..');

    instance.started = true;
    instance.startCb.forEach((callback) => callback());
  });
}

function listenLog(worker, workerProcess) {
  let workerIpc = ipc(workerProcess);

  debugStrategy('establishing listeners for electron logs in worker [' + worker.id + ']..');

  workerIpc.on('page-error', (windowId, errMsg, errStack) => {
    debugPage('An error has ocurred in browser window [%s]: message: %s stack: %s', windowId, errMsg, errStack);
  });

  workerIpc.on('page-log', function() {
    let newArgs = sliced(arguments),
        windowId = newArgs.splice(0, 1);

    newArgs.unshift('console log from browser window [' + windowId + ']:');
    debugPage.apply(debugPage, newArgs);
  });

  workerIpc.on('log', function() {
    debugElectronLog.apply(debugElectronLog, sliced(arguments));
  });
}

export default function(options) {
  const workersOptions = { ...options, pathToScript: SEVER_SCRIPT_PATH, env: {} };

  if (process.env.ELECTRON_HTML_TO_DEBUGGING !== undefined) {
    debugStrategy('electron process debugging mode activated');

    workersOptions.env.ELECTRON_HTML_TO_DEBUGGING = process.env.ELECTRON_HTML_TO_DEBUGGING;
  }

  workersOptions.env.chromeCommandLineSwitches = JSON.stringify(options.chromeCommandLineSwitches || {});
  workersOptions.env.allowLocalFilesAccess = JSON.stringify(options.allowLocalFilesAccess || false);

  workersOptions.stdio = [null, null, null, 'ipc'];
  workersOptions.killSignal = 'SIGKILL';

  const workers = electronWorkers(workersOptions);

  function serverStrategyCall(requestOptions, converterPath, id, cb) {
    let executeOpts = {};

    debugStrategy('checking if electron workers have started..');

    ensureStart(workers, serverStrategyCall, (err) => {
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

  serverStrategyCall.startCb = [];

  serverStrategyCall.kill = () => {
    debugStrategy('killing electron workers..');

    if (!serverStrategyCall.started) {
      return;
    }

    serverStrategyCall.started = false;
    serverStrategyCall.startCb = [];
    workers.kill();
  };

  return serverStrategyCall;
}
