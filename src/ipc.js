/* eslint no-var: [0] */

var EventEmitter = require('events').EventEmitter,
    sliced = require('sliced');

function IPC(processObj) {
  var emitter = new EventEmitter(),
      emit = emitter.emit;

  // no parent
  if (!processObj.send) {
    return emitter;
  }

  processObj.on('message', function(data) {
    var shouldIgnore = false;

    // not handling electron-workers events here
    if (data) {
      shouldIgnore = data.workerEvent === 'ping' || data.workerEvent === 'pong' || data.workerEvent === 'task';

      if (shouldIgnore) {
        return;
      }
    }

    emit.apply(emitter, sliced(data));
  });

  emitter.emit = function() {
    if (processObj.connected) {
      processObj.send(sliced(arguments));
    }
  };

  return emitter;
}

module.exports = IPC;
