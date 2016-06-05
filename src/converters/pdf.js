
const path = require('path'),
      fs = require('fs'),
      assign = require('object-assign'),
      pdfParser = require('../pdfParser');

module.exports = function(log, settings, browserWindow, done) {
  let pdfDefaults = {
    marginsType: 0,
    pageSize: 'A4',
    printBackground: false,
    landscape: false
  };

  // TODO: support headerHeight, footerHeight when electron support rendering PDF's header/footer
  let pdfSettings = settings.pdf,
      pdfOptions = assign({}, pdfDefaults, pdfSettings, { printSelectionOnly: false });

  log('before printing..');
  log('pdf options:', pdfOptions);

  browserWindow.webContents.printToPDF(pdfOptions, (err, pdfBuf) => {
    let dist = path.join(settings.output.tmpDir, `${settings.output.id}.pdf`);

    if (err) {
      return done(err);
    }

    // don't know why the electron process hangs up if i don't log anything here
    // (probably pdf.js?)
    // anyway this log prevent the conversion to stop
    log('after printing..');
    log('parsing pdf..');

    pdfParser(pdfBuf, (pdfParseErr, pdfDoc) => {
      log('pdf parsing complete..');

      if (pdfParseErr) {
        return done(pdfParseErr);
      }

      // when running in IISNODE electron hangs when using fs.readFile, fs.createReadStream
      // or any async API for read a file.. on normal windows + node electron consumes 100% CPU when
      // using any async file API, so the only/best option is to read the file in a synchronous way
      if (process.platform === 'win32') {
        try {
          fs.writeFileSync(dist, pdfBuf);

          done(null, {
            numberOfPages: pdfDoc.numPages,
            output: dist
          });
        } catch (saveErr) {
          done(saveErr);
        }
      } else {
        fs.writeFile(dist, pdfBuf, (saveErr) => {
          if (saveErr) {
            return done(saveErr);
          }

          done(null, {
            numberOfPages: pdfDoc.numPages,
            output: dist
          });
        });
      }
    });
  });
};
