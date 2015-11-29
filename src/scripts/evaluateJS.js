/* eslint-disable */
'use strict';

var renderer = require('electron').ipcMain,
    sliced = require('sliced'),
    evaluateTemplate = require('./evaluateTemplate');

function evaluate(bWindow, src, done) {
  var id = bWindow.id;

  renderer.once(`${id}:evaluateResponse`, (ev, response) => {
    done(null, response);
  });

  renderer.once(`${id}:evaluateError`, (ev, error) => {
    done(error);
  });

  bWindow.webContents.executeJavaScript(src);
}

module.exports = function(bWindow) {
  return function(fn/**, arg1, arg2..., done**/) {
    var args = sliced(arguments),
        done = args[args.length - 1],
        newArgs = args.slice(1, -1),
        src;

    src = evaluateTemplate.execute({
      id: bWindow.id,
      src: String(fn),
      args: newArgs
    });

    evaluate(bWindow, src, done);
  };
};
