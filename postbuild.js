/* eslint no-var: [0] */

var path = require('path'),
    cp = require('cp');

var src = path.join(__dirname, 'src/pdfParser/pdf.combined.js'),
    dist = path.join(__dirname, 'lib/pdfParser/pdf.combined.js');

cp.sync(src, dist);
