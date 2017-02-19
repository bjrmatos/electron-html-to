
const urlModule = require('url');

module.exports = function(browserWindow, options, log, saveLogInPage) {
  let allowLocalFilesAccess = options.allowLocalFilesAccess,
      parsedPageUrl = urlModule.parse(options.pageUrl),
      pageProtocol,
      redirectURL,
      pageRequested = false;

  if (!parsedPageUrl.protocol) {
    pageProtocol = 'file';
  } else {
    // removing ':'
    pageProtocol = parsedPageUrl.protocol.slice(0, -1);
  }

  browserWindow.webContents.session.webRequest.onBeforeRequest((details, cb) => {
    let resourceUrl = details.url,
        msg;

    if (!pageRequested) {
      msg = `request to load the page: ${resourceUrl}`;
      pageRequested = true;

      log(msg);

      saveLogInPage('debug', msg);

      return cb({ cancel: false });
    }

    msg = `request for resource: ${resourceUrl}, resourceType: ${details.resourceType}`;

    log(msg);

    saveLogInPage('debug', msg);

    if (resourceUrl.lastIndexOf('file:///', 0) === 0 && !allowLocalFilesAccess) {
      // potentially dangerous request
      msg = `denying request to a file because local file access is disabled, url: ${resourceUrl}`;

      log(msg);

      saveLogInPage('warn', msg);

      return cb({ cancel: true });
    } else if (resourceUrl.lastIndexOf('file://', 0) === 0 && resourceUrl.lastIndexOf('file:///', 0) !== 0) {
      // support cdn like format -> //cdn.jquery...
      if (pageProtocol === 'file') {
        redirectURL = `http://${resourceUrl.substr(7)}`;
      } else {
        redirectURL = `${pageProtocol}://${resourceUrl.substr(7)}`;
      }

      msg = `handling cdn format request, url: ${resourceUrl.substr(7)}, redirecting to: ${redirectURL}`;

      log(msg);

      saveLogInPage('debug', msg);

      return cb({
        cancel: false,
        redirectURL
      });
    }

    cb({ cancel: false });
  });

  browserWindow.webContents.session.webRequest.onCompleted((details) => {
    let msg = (
      `request for resource completed: ${details.url}, resourceType: ${details.resourceType}, status: ${details.statusCode}`
    );

    log(msg);

    saveLogInPage('debug', msg);
  });

  browserWindow.webContents.session.webRequest.onErrorOccurred((details) => {
    let msg = (
      `request for resource failed: ${details.url}, resourceType: ${details.resourceType}, error: ${details.error}`
    );

    log(msg);

    saveLogInPage('warn', msg);
  });
};
