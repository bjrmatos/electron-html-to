/* eslint no-var: [0] */

var path = require('path'),
    assign = require('object-assign'),
    pick = require('lodash.pick');

var browserWindowDefaults = {
  width: 600,
  height: 600
};

var webPreferencesDefaults = {
  'node-integration': false,
  javascript: true,
  'web-security': false
};

module.exports = function(browserWindowSettings) {
  var browserWindowOpts,
      webPreferences;

  browserWindowOpts = pick(browserWindowSettings || {}, [
    'width',
    'height',
    'x',
    'y',
    'use-content-size',
    'web-preferences'
  ]);

  browserWindowOpts = assign({}, browserWindowDefaults, browserWindowOpts, {
    show: false
  });

  webPreferences = pick(browserWindowOpts['web-preferences'] || {}, [
    'node-integration',
    'partition',
    'zoom-factor',
    'javascript',
    'web-security',
    'allow-displaying-insecure-content',
    'allow-running-insecure-content',
    'images',
    'java',
    'webgl',
    'webaudio',
    'plugins',
    'experimental-features',
    'experimental-canvas-features',
    'overlay-scrollbars',
    'overlay-fullscreen-video',
    'shared-worker',
    'direct-write'
  ]);

  browserWindowOpts['web-preferences'] = assign({}, webPreferencesDefaults, webPreferences, {
    preload: path.join(__dirname, 'preload.js')
  });

  return browserWindowOpts;
};
