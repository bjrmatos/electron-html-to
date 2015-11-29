
(function() {
  /* eslint-disable */
  window.__electron_html_to = {};

  var remote = require('electron').remote,
      currentWindow = remote.getCurrentWindow(),
      dataWindow = remote.getGlobal('windowsData')[currentWindow.id];

  __electron_html_to.ipc = require('electron').ipcRenderer;
  __electron_html_to.sliced = require('sliced');
  __electron_html_to.windowId = currentWindow.id;

  __electron_html_to.ipc.send('log', currentWindow.id, 'loading preload script');

  window.addEventListener('error', function(pageErr) {
    __electron_html_to.ipc.send('page-error', __electron_html_to.windowId, pageErr.message, pageErr.error.stack);
  });

  var defaultLog = console.log;

  console.log = function() {
    var newArgs = __electron_html_to.sliced(arguments);

    newArgs.unshift(__electron_html_to.windowId);

    __electron_html_to.ipc.send('page-log', newArgs);
    return defaultLog.apply(this, arguments);
  };

  if (dataWindow.waitForJS) {
    if (typeof Object.defineProperty === 'function') {
      __electron_html_to.ipc.send('log', __electron_html_to.windowId, 'defining waitForJS callback..');

      Object.defineProperty(window, dataWindow.waitForJSVarName, {
        set: function(val) {
          if (!val) {
            return;
          }

          if (val === true) {
            __electron_html_to.ipc.send('log', __electron_html_to.windowId, 'waitForJS callback called..');
            __electron_html_to.ipc.send(__electron_html_to.windowId + ':waitForJS');
          }
        }
      });
    }

    remote = null;
    currentWindow = null;
    dataWindow = null;
  } else {
    remote = null;
    currentWindow = null;
    dataWindow = null;
  }
})();
