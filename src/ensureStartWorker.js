
import debug from 'debug';
import sliced from 'sliced';
import ipc from './ipc';
import { name as pkgName } from '../package.json';

const debugPage = debug(`${pkgName}:page`),
      debugElectronLog = debug(`${pkgName}:electron-log`);

function listenLog(debugStrategy, worker, workerProcess) {
  let workerIpc = ipc(workerProcess);

  debugStrategy(`establishing listeners for electron logs in worker [${worker.id}]..`);

  workerIpc.on('page-error', (windowId, errMsg, errStack) => {
    debugPage('An error has ocurred in browser window [%s]: message: %s stack: %s', windowId, errMsg, errStack);
  });

  workerIpc.on('page-log', function() {
    // eslint-disable-next-line prefer-rest-params
    let newArgs = sliced(arguments),
        windowId = newArgs.splice(0, 1);

    newArgs.unshift(`console log from browser window [${windowId}]:`);
    debugPage.apply(debugPage, newArgs);
  });

  workerIpc.on('log', function() {
    // eslint-disable-next-line prefer-rest-params
    debugElectronLog.apply(debugElectronLog, sliced(arguments));
  });
}

export default function ensureStart(debugStrategy, workers, instance, cb) {
  if (instance.started) {
    return cb();
  }

  instance.startCb.push(cb);

  if (instance.starting) {
    return;
  }

  debugStrategy('starting electron workers..');

  // eslint-disable-next-line no-param-reassign
  instance.starting = true;

  workers.on('workerProcessCreated', (worker, workerProcess) => {
    listenLog(debugStrategy, worker, workerProcess);
  });

  workers.start((startErr) => {
    // eslint-disable-next-line no-param-reassign
    instance.starting = false;

    if (startErr) {
      instance.startCb.forEach((callback) => callback(startErr));
      return;
    }

    debugStrategy('electron workers started successfully..');

    // eslint-disable-next-line no-param-reassign
    instance.started = true;
    instance.startCb.forEach((callback) => callback());
  });
}
