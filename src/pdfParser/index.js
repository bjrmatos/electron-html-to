
let pdfjs = require('pdfjs-dist/build/pdf');

module.exports = function parsePDF(pdfBuf, cb) {
  let pdfData;

  try {
    pdfData = new Uint8Array(pdfBuf);

    pdfjs.getDocument(pdfData).then((doc) => {
      cb(null, doc);
    }).catch((err) => {
      cb(err);
    });
  } catch (uncaughtErr) {
    cb(uncaughtErr);
  }
};
