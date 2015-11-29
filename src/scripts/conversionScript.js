/* eslint no-var: [0] */

var renderer = require('electron').ipcMain,
    assign = require('object-assign');

module.exports = function(settings, browserWindow, evaluate, log, converter, respond) {
  var pageJSisDone = settings.waitForJS ? false : true;

  renderer.once(browserWindow.id + ':waitForJS', function() {
    log('waitForJS signal received..');
    pageJSisDone = true;
  });

  browserWindow.webContents.on('did-finish-load', function() {
    log('browser window loaded..');

    evaluate(function() {
      var sElectronHeader = '#electronHeader',
          sElectronFooter = '#electronFooter';

      return {
        electronHeader: document.querySelector(sElectronHeader) ? document.querySelector(sElectronHeader).innerHTML : null,
        electronFooter: document.querySelector(sElectronFooter) ? document.querySelector(sElectronFooter).innerHTML : null
      };
    }, function(err, extraContent) {
      /* eslint no-unused-vars: [0] */
      if (err) {
        return respond(err);
      }

      // TODO: ask support for header/footer pdf and numberOfPages in electron
      log('waiting for browser window resolution..');

      setTimeout(function() {
        resolvePage();
      }, settings.delay || 0);

      function resolvePage() {
        if (settings.waitForJS && !pageJSisDone) {
          setTimeout(function() {
            resolvePage();
          }, 100);

          return;
        }

        evaluate(function() {
          return window.document.documentElement.outerHTML;
        }, function(getHtmlErr, html) {
          if (getHtmlErr) {
            return respond(getHtmlErr);
          }

          log('calling converter function..');

          converter(log, html, assign({}, settings), browserWindow, function(converterErr, data) {
            log('converter function ended..');
            respond(converterErr, data);
          });
        });
      }
    });
  });
};
