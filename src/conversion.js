
import path from 'path';
import debug from 'debug';
import uuid from 'uuid';
import { name as pkgName } from '../package.json';
import saveFile from './saveFile';
import serverStrategy from './serverStrategy';
import dedicatedProcessStrategy from './dedicatedProcessStrategy';

const debugConversion = debug(pkgName + ':conversion');

function writeHtmlFile(opt, tmpPath, type, id, cb) {
  let htmlPath;

  if (!opt[type]) {
    return cb();
  }

  htmlPath = path.resolve(path.join(tmpPath, id + type + '.html'));
  opt[type + 'File'] = path.resolve(htmlPath);

  debugConversion('creating temporal html file [type: %s] in %s..', type, htmlPath);
  saveFile(tmpPath, htmlPath, opt[type], cb);
}

function writeHtml(opt, tmpPath, id, cb) {
  debugConversion('creating temporal html files in %s..', tmpPath);

  writeHtmlFile(opt, tmpPath, 'html', id, (htmlErr) => {
    if (htmlErr) {
      return cb(htmlErr);
    }

    writeHtmlFile(opt, tmpPath, 'header', id, (headerErr) => {
      if (headerErr) {
        return cb(headerErr);
      }

      writeHtmlFile(opt, tmpPath, 'footer', id, (footerErr) => {
        if (footerErr) {
          return cb(footerErr);
        }

        cb();
      });
    });
  });
}

function createConversion(options) {
  // each conversion instance will create a new electron-workers instance.
  let serverStrategyCall = serverStrategy(options);

  let conversion = (conversionOpts, cb) => {
    let localOpts = conversionOpts,
        converterPath,
        id;

    const conversionOptsDefault = {
      browserWindow: {
        webPreferences: {}
      },
      waitForJSVarName: 'ELECTRON_HTML_TO_READY'
    };

    debugConversion('generating new conversion task..');

    if (typeof conversionOpts === 'string' || conversionOpts instanceof String) {
      debugConversion('normalizing local options object from a plain string parameter: %s', conversionOpts);

      localOpts = {
        html: conversionOpts
      };
    }

    localOpts = { ...conversionOptsDefault, ...localOpts };

    if (localOpts.converterPath) {
      converterPath = localOpts.converterPath;
    } else {
      converterPath = options.converterPath;
    }

    if (localOpts.waitForJS && localOpts.browserWindow.webPreferences && localOpts.browserWindow.webPreferences.javascript === false) {
      throw new Error('can\'t use waitForJS option if browserWindow["web-preferences"].javascript is not activated');
    }

    id = uuid.v4();
    debugConversion('conversion task id: %s', id);

    writeHtml(localOpts, options.tmpDir, id, (err) => {
      if (err) {
        return cb(err);
      }

      // prefix the request in order to recognize later in electron protocol handler
      localOpts.url = localOpts.url || 'file:///electron-html-to/' + encodeURIComponent(localOpts.htmlFile);
      localOpts.chromeCommandLineSwitches = options.chromeCommandLineSwitches;

      localOpts.output = {
        tmpDir: path.resolve(path.join(options.tmpDir)),
        id: id
      };

      delete localOpts.html;

      debugConversion('starting conversion task [strategy:%s][task id:%s] with options:', options.strategy, id, localOpts);

      if (options.strategy === 'electron-server') {
        return serverStrategyCall(localOpts, converterPath, id, cb);
      }

      if (options.strategy === 'dedicated-process') {
        return dedicatedProcessStrategy(options, localOpts, converterPath, id, cb);
      }

      cb(new Error('Unsupported strategy ' + options.strategy));
    });
  };

  function kill() {
    serverStrategyCall.kill();
  }

  conversion.options = options;
  conversion.kill = kill;

  return conversion;
}

export default createConversion;
