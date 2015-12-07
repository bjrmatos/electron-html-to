/* eslint no-var: [0] */

var path = require('path'),
    fs = require('fs'),
    assign = require('object-assign'),
    pdfParser = require('../pdfParser');

module.exports = function(log, settings, browserWindow, done) {
  var pdfDefaults = {
    marginsType: 0,
    pageSize: 'A4',
    printBackground: false,
    landscape: false
  };

  // TODO: support headerHeight, footerHeight when electron support rendering PDF's header/footer
  var pdfSettings = settings.pdf,
      pdfOptions = assign({}, pdfDefaults, pdfSettings, { printSelectionOnly: false });

  log('before printing..');

  browserWindow.printToPDF(pdfOptions, function(err, pdfBuf) {
    var dist = path.join(settings.output.tmpDir, settings.output.id + '.pdf');

    if (err) {
      return done(err);
    }

    // don't know why the electron process hangs up if i don't log anything here
    // (probably pdf.js?)
    // anyway this log prevent the conversion to stop
    log('after printing..');
    log('parsing pdf..');

    pdfParser(pdfBuf, function(pdfParseErr, pdfDoc) {
      log('pdf parsing complete..');

      if (pdfParseErr) {
        return done(pdfParseErr);
      }

      fs.writeFile(dist, pdfBuf, function(saveErr) {
        if (saveErr) {
          return done(saveErr);
        }

        done(null, {
          numberOfPages: pdfDoc.numPages,
          output: dist
        });
      });
    });
  });
};
