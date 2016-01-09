/* eslint no-var: [0] */

var path = require('path'),
    fs = require('fs'),
    mime = require('mime-types'),
    CUSTOM_PROTOCOL = 'electron-html-to';

function isURLEncoded(url) {
  return decodeURIComponent(url) !== url;
}

module.exports = function(protocol, allowLocalFilesAccess, log, done) {
  var protocolsCompleted = 0;

  function resolveRegistration(err) {
    if (resolveRegistration.called) {
      return;
    }

    resolveRegistration.called = true;
    done(err);
  }

  protocol.registerStandardSchemes([CUSTOM_PROTOCOL]);

  protocol.registerBufferProtocol(CUSTOM_PROTOCOL, function(request, callback) {
    var url = request.url.substr(CUSTOM_PROTOCOL.length + 3),
        mimeType,
        fileBuf;

    log(CUSTOM_PROTOCOL + ' file protocol request for:', request.url);

    if (isURLEncoded(url)) {
      url = decodeURIComponent(url);
    }

    if (process.platform === 'win32' && url.slice(0, 1) === '/') {
      url = url.slice(1);
    }

    mimeType = mime.lookup(path.extname(url)) || 'text/plain';

    log('handling ' + CUSTOM_PROTOCOL + ' file protocol request. response file path:', url, ', mime:', mimeType);

    if (process.platform === 'win32') {
      // when running in IISNODE electron hangs when using fs.readFile, fs.createReadStream
      // or any async API for read a file.. on normal windows + node electron consumes 100% CPU when
      // using any async file API, so the only/best option is to read the file in a synchronous way
      try {
        fileBuf = fs.readFileSync(url);
        callback({ data: fileBuf, mimeType: mimeType });
      } catch (err) {
        callback();
      }
    } else {
      fs.readFile(url, function(err, buf) {
        if (err) {
          return callback();
        }

        fileBuf = buf;
        callback({ data: fileBuf, mimeType: mimeType });
      });
    }
  }, function(registerProtocolErr) {
    protocolsCompleted++;

    if (registerProtocolErr) {
      log('electron fails to register "' + CUSTOM_PROTOCOL + '" file protocol');
      return resolveRegistration(registerProtocolErr);
    }

    log('registration for custom file protocol "' + CUSTOM_PROTOCOL + '" was successfully');

    if (protocolsCompleted === 2) {
      resolveRegistration(null);
    }
  });

  protocol.interceptHttpProtocol('file', function(request, callback) {
    var url = request.url.substr(7),
        delegateProtocolScheme = CUSTOM_PROTOCOL + '://';

    log('file protocol request for:', request.url);

    // request to the page
    if (url.lastIndexOf('/electron-html-to/', 0) === 0) {
      url = url.replace('/electron-html-to/', '');
      url = delegateProtocolScheme + url;
      log('handling file protocol request to load the page. response file url:', url);
      callback({ url: url });
    } else if (request.url.lastIndexOf('file:///', 0) === 0 && !allowLocalFilesAccess) {
      // potentially dangerous request
      log('denying access to a file, url:', request.url);
      // Permission to access a resource, other than the network, was denied.
      // see https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h
      callback(-10);
    } else if (request.url.lastIndexOf('file://', 0) === 0 && request.url.lastIndexOf('file:///', 0) !== 0) {
      // support cdn like format -> //cdn.jquery...
      url = 'http://' + url;
      log('handling cdn format request, response url:', url);
      callback({ url: url });
    } else {
      url = delegateProtocolScheme + url;
      log('response file url:', url);
      callback({ url: url });
    }
  }, function(interceptProtocolErr) {
    protocolsCompleted++;

    if (interceptProtocolErr) {
      log('electron fails to register file protocol');
      return resolveRegistration(interceptProtocolErr);
    }

    log('interception for file protocol register successfully');

    if (protocolsCompleted === 2) {
      resolveRegistration(null);
    }
  });
};
