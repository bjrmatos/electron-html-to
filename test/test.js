
import path from 'path';
import fs from 'fs';
import should from 'should';
import convertFactory from '../src/index';

const tmpDir = path.join(__dirname, 'temp');

function createConversion(strategy) {
  return convertFactory({
    converterPath: convertFactory.converters.PDF,
    timeout: 10000,
    tmpDir: tmpDir,
    portLeftBoundary: 10000,
    portRightBoundary: 15000,
    strategy: strategy
  });
}

function rmDir(dirPath) {
  let files;

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }

  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    return;
  }

  if (files.length > 0) {
    for (let ix = 0; ix < files.length; ix++) {
      let filePath = dirPath + '/' + files[ix];

      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }
  }
}

/* eslint padded-blocks: [0] */
describe('electron html to pdf', () => {
  describe('dedicated-process', () => {
    common('dedicated-process');
  });

  describe('electron-server', () => {
    common('electron-server');
  });

  describe('electron-ipc', () => {
    common('electron-ipc');
  });

  function common(strategy) {
    let conversion = createConversion(strategy);

    after(() => {
      rmDir(tmpDir);
    });

    it('should set number of pages correctly', function(done) {
      conversion('<h1>aa</h1><div style="page-break-before: always;"></div><h1>bb</h1>', (err, res) => {
        if (err) {
          return done(err);
        }

        res.numberOfPages.should.be.eql(2);
        done();
      });
    });

    it('should create a pdf file', function(done) {
      conversion('<h1>foo</h1>', (err, res) => {
        if (err) {
          return done(err);
        }

        should(res.numberOfPages).be.eql(1);
        should(res.stream).have.property('readable');
        done();
      });
    });

    it('should create a pdf file with header');

    it('should create a pdf file with footer');

    it('should create a pdf file with header and footer');

    it('should create a pdf file ignoring ssl errors', function(done) {
      conversion({
        url: 'https://sygris.com'
      }, (err, res) => {
        if (err) {
          return done(err);
        }

        should(res.numberOfPages).be.eql(1);
        should(res.stream).have.property('readable');
        done();
      });
    });

    it('should wait for page js execution', function(done) {
      conversion({
        html: '<h1>aa</h1><script>window.ELECTRON_HTML_TO_READY = true;</script>',
        waitForJS: true
      }, function(err, res) {
        if (err) {
          return done(err);
        }

        should(res.numberOfPages).be.eql(1);
        should(res.stream).have.property('readable');
        done();
      });
    });

    it('should wait for page async js execution', function(done) {
      conversion({
        html: '<h1>aa</h1><script>setTimeout(function() { window.ELECTRON_HTML_TO_READY = true; }, 200);</script>',
        waitForJS: true
      }, function(err, res) {
        if (err) {
          return done(err);
        }

        should(res.numberOfPages).be.eql(1);
        should(res.stream).have.property('readable');
        done();
      });
    });

    it('should allow define a custom var name for page js execution', function(done) {
      conversion({
        html: '<h1>aa</h1><script>window.ready = true;</script>',
        waitForJS: true,
        waitForJSVarName: 'ready'
      }, function(err, res) {
        if (err) {
          return done(err);
        }

        should(res.numberOfPages).be.eql(1);
        should(res.stream).have.property('readable');
        done();
      });
    });

    it('should throw timeout when waiting for page js execution', function(done) {
      conversion({
        html: '<h1>aa</h1>',
        timeout: 500,
        waitForJS: true
      }, function(err) {
        if (!err) {
          return done(new Error('the conversion doesn\'t throw error'));
        }

        if (err.electronTimeout !== undefined) {
          should(err.electronTimeout).be.eql(true);
          done();
        } else {
          done(err);
        }
      });
    });

    it('should work with javascript disabled in web page', function(done) {
      conversion({
        html: '<h1>foo</h1>',
        browserWindow: {
          webPreferences: {
            javascript: false
          }
        }
      }, function(err, res) {
        if (!err) {
          return done(err);
        }

        should(res.numberOfPages).be.eql(1);
        should(res.stream).have.property('readable');
        done();
      });
    });
  }

});
