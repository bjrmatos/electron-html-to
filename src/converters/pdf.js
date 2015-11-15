/* eslint no-var: [0] */

var path = require('path'),
    fs = require('fs'),
    assign = require('object-assign'),
    pdfParser = require('../pdfParser');

module.exports = function(html, settings, browserWindow, done) {
  var pdfDefaults = {
    marginsType: 0,
    pageSize: 'A4',
    printBackground: false,
    landscape: false
  };

  // TODO: support headerHeight, footerHeight when electron support rendering PDF's header/footer
  var pdfSettings = settings.pdf,
      pdfOptions = assign({}, pdfDefaults, pdfSettings, { printSelectionOnly: false });

  browserWindow.printToPDF(pdfOptions, function(err, pdfBuf) {
    var dist = path.join(settings.output.tmpDir, settings.output.id + '.pdf');

    if (err) {
      return done(err);
    }

    // don't know why the pdf parser logic
    // stops when the electron process is not focused in the OS..
    // anyway this console.log prevent the conversion to stop
    /* eslint no-console: [0] */
    console.log('DON\'T FREEZE PDFJS!');

    pdfParser(pdfBuf, function(pdfParseErr, pdfDoc) {
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
