
// disabling import rule because `electron` is a built-in module
// eslint-disable-next-line import/no-unresolved
const renderer = require('electron').ipcMain,
      assign = require('object-assign');

module.exports = function(settings, browserWindow, evaluate, log, converter, respond) {
  let pageJSisDone = !Boolean(settings.waitForJS);

  renderer.once(`${browserWindow.id}:waitForJS`, () => {
    log('waitForJS signal received..');
    pageJSisDone = true;
  });

  browserWindow.webContents.on('did-finish-load', () => {
    log('browser window loaded..');

    if (settings.browserWindow.webPreferences.javascript === false) {
      log('javascript is disabled for the page..');

      next();
    } else {
      evaluate(() => {
        const sElectronHeader = '#electronHeader',
              sElectronFooter = '#electronFooter';

        return {
          electronHeader: document.querySelector(sElectronHeader) ? document.querySelector(sElectronHeader).innerHTML : null,
          electronFooter: document.querySelector(sElectronFooter) ? document.querySelector(sElectronFooter).innerHTML : null
        };
      }, (err, extraContent) => {
        if (err) {
          return respond(err);
        }

        next(extraContent);
      });
    }

    function next(extraContent) {
      /* eslint no-unused-vars: [0] */
      // TODO: ask support for header/footer pdf and numberOfPages in electron
      log('waiting for browser window resolution..');

      setTimeout(() => {
        resolvePage();
      }, settings.delay || 0);
    }

    function resolvePage() {
      if (settings.waitForJS && !pageJSisDone) {
        setTimeout(() => {
          resolvePage();
        }, 100);

        return;
      }

      log('calling converter function..');

      converter(log, assign({}, settings), browserWindow, (converterErr, data) => {
        log('converter function ended..');
        respond(converterErr, data);
      });
    }
  });
};
