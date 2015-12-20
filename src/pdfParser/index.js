/* eslint no-var: [0] */

// from https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.js
var DOMParserMock = require('./domparsermock.js').DOMParserMock;

// HACK few hacks to let PDF.js be loaded not as a module in global space.
global.window = global;
global.navigator = { userAgent: 'node' };

global.PDFJS = {
  workerSrc: true // value to make it work inside iron-node and electron
};

global.DOMParser = DOMParserMock;

require('./pdf.combined.js');

module.exports = function parsePDF(pdfBuf, cb) {
  var pdfData;

  try {
    pdfData = new Uint8Array(pdfBuf);

    global.PDFJS.getDocument(pdfData).then(function(doc) {
      cb(null, doc);
    }).catch(function(err) {
      cb(err);
    });
  } catch (uncaughtErr) {
    cb(uncaughtErr);
  }
};
