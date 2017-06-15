
import path from 'path';
import url from 'url';
import debug from 'debug';
import uuid from 'uuid';
import assign from 'object-assign';
import mkdirp from 'mkdirp';
import { name as pkgName } from '../package.json';
import saveFile from './saveFile';
import serverIpcStrategy from './serverIpcStrategy';
import dedicatedProcessStrategy from './dedicatedProcessStrategy';

const debugConversion = debug(`${pkgName}:conversion`);

function writeHtmlFileIfNeccesary(opt, tmpPath, type, id, cb) {
  let htmlPath;

  if (!opt[type]) {
    return cb();
  }

  htmlPath = path.resolve(path.join(tmpPath, `${id + type}.html`));
  // eslint-disable-next-line no-param-reassign
  opt[`${type}File`] = path.resolve(htmlPath);

  debugConversion('creating temporal html file [type: %s] in %s..', type, htmlPath);
  saveFile(tmpPath, htmlPath, opt[type], cb);
}

function writeHtmlIfNeccesary(opt, tmpPath, id, cb) {
  debugConversion('creating temporal html files in %s..', tmpPath);

  writeHtmlFileIfNeccesary(opt, tmpPath, 'html', id, (htmlErr) => {
    if (htmlErr) {
      return cb(htmlErr);
    }

    writeHtmlFileIfNeccesary(opt, tmpPath, 'header', id, (headerErr) => {
      if (headerErr) {
        return cb(headerErr);
      }

      writeHtmlFileIfNeccesary(opt, tmpPath, 'footer', id, (footerErr) => {
        if (footerErr) {
          return cb(footerErr);
        }

        cb();
      });
    });
  });
}

function createConversion(options) {
  let mode;
  let serverIpcStrategyCall;

  if (options.strategy === 'electron-server') {
    mode = 'server';
  } else if (options.strategy === 'electron-ipc') {
    mode = 'ipc';
  }

  if (options.strategy === 'electron-server' || options.strategy === 'electron-ipc') {
    // each instance with ipc or server mode will create a new electron-workers instance.
    serverIpcStrategyCall = serverIpcStrategy(mode, options);
  }

  let conversion = (conversionOpts, cb) => {
    let localOpts = conversionOpts,
        converterPath,
        id;

    const conversionOptsDefault = {
      browserWindow: {
        webPreferences: {}
      },
      waitForJSVarName: 'ELECTRON_HTML_TO_READY',
      collectLogs: true
    };

    debugConversion('generating new conversion task..');

    if (typeof conversionOpts === 'string' || conversionOpts instanceof String) {
      debugConversion('normalizing local options object from a plain string parameter: %s', conversionOpts);

      localOpts = {
        html: conversionOpts
      };
    }

    localOpts = assign({}, conversionOptsDefault, localOpts);

    if (localOpts.converterPath) {
      converterPath = localOpts.converterPath;
    } else {
      converterPath = options.converterPath;
    }

    if (localOpts.waitForJS && localOpts.browserWindow.webPreferences &&
      localOpts.browserWindow.webPreferences.javascript === false) {
      throw new Error('can\'t use waitForJS option if browserWindow["web-preferences"].javascript is not activated');
    }

    id = uuid.v4();
    debugConversion('conversion task id: %s', id);

    mkdirp(options.tmpDir, (mkdirErr) => {
      if (mkdirErr) {
        // eslint-disable-next-line no-param-reassign
        mkdirErr.message = `Error while trying to ensure tmpDir "${options.tmpDir}" existence: ${mkdirErr.message}`;
        return cb(mkdirErr);
      }

      writeHtmlIfNeccesary(localOpts, options.tmpDir, id, (err) => {
        if (err) {
          return cb(err);
        }

        // prefix the request in order to recognize later in electron protocol handler
        localOpts.url = localOpts.url || url.format({
          protocol: 'file',
          pathname: localOpts.htmlFile
        });

        localOpts.chromeCommandLineSwitches = options.chromeCommandLineSwitches;
        localOpts.extraHeaders = localOpts.extraHeaders || {};

        localOpts.output = {
          tmpDir: path.resolve(path.join(options.tmpDir)),
          id
        };

        delete localOpts.html;

        debugConversion('starting conversion task [strategy:%s][task id:%s] with options:', options.strategy, id, localOpts);

        if (options.strategy === 'electron-server' || options.strategy === 'electron-ipc') {
          return serverIpcStrategyCall(localOpts, converterPath, id, cb);
        }

        if (options.strategy === 'dedicated-process') {
          return dedicatedProcessStrategy(options, localOpts, converterPath, id, cb);
        }

        cb(new Error(`Unsupported strategy ${options.strategy}`));
      });
    });
  };

  function kill() {
    if (serverIpcStrategyCall) {
      serverIpcStrategyCall.kill();
    }
  }

  conversion.options = options;
  conversion.kill = kill;

  return conversion;
}

export default createConversion;
