
// from https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.js
let DOMParserMock = require('./domparsermock.js').DOMParserMock;

// HACK few hacks to let PDF.js be loaded not as a module in global space.
global.window = global;
global.navigator = { userAgent: 'node' };

global.PDFJS = {
  workerSrc: true // value to make it work inside iron-node and electron
};

global.DOMParser = DOMParserMock;

require('./pdf.combined.js');

module.exports = function parsePDF(pdfBuf, cb) {
  let pdfData;

  try {
    pdfData = new Uint8Array(pdfBuf);

    global.PDFJS.getDocument(pdfData).then((doc) => {
      cb(null, doc);
    }).catch((err) => {
      cb(err);
    });
  } catch (uncaughtErr) {
    cb(uncaughtErr);
  }
};
