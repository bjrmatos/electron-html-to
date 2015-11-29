/* eslint no-var: [0] */

var path = require('path'),
    assign = require('object-assign'),
    pick = require('lodash.pick');

var browserWindowDefaults = {
  width: 600,
  height: 600
};

var webPreferencesDefaults = {
  nodeIntegration: false,
  javascript: true,
  webSecurity: false
};

module.exports = function(browserWindowSettings) {
  var browserWindowOpts,
      webPreferences;

  browserWindowOpts = pick(browserWindowSettings || {}, [
    'width',
    'height',
    'x',
    'y',
    'useContentSize',
    'webPreferences'
  ]);

  browserWindowOpts = assign({}, browserWindowDefaults, browserWindowOpts, {
    show: false
  });

  webPreferences = pick(browserWindowOpts.webPreferences || {}, [
    'nodeIntegration',
    'partition',
    'zoomFactor',
    'javascript',
    'webSecurity',
    'allowDisplayingInsecureContent',
    'allowRunningInsecureContent',
    'images',
    'java',
    'webgl',
    'webaudio',
    'plugins',
    'experimentalFeatures',
    'experimentalCanvasFeatures',
    'overlayScrollbars',
    'overlayFullscreenVideo',
    'sharedWorker',
    'directWrite'
  ]);

  browserWindowOpts.webPreferences = assign({}, webPreferencesDefaults, webPreferences, {
    preload: path.join(__dirname, 'preload.js')
  });

  return browserWindowOpts;
};
