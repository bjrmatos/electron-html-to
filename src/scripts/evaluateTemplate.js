/* eslint-disable */
'use strict';

var minstache = require('minstache');

/**
 * Run the `src` function on the client-side (renderer-process), capture
 * the response, and send back via
 * ipc to electron's main process
 */

var execute = [
  "(function evaluateJavaScript() {",
  "  var ipc = __electron_html_to.ipc;",
  "  var sliced = __electron_html_to.sliced;",
  "  ipc.send('log', {{id}}, 'evaluating javascript in page..');",
  "  try {",
  "    var response = ({{!src}})({{!args}})",
  "    ipc.send('{{id}}:evaluateResponse', response);",
  "  } catch (e) {",
  "    ipc.send('{{id}}:evaluateError', e.message);",
  "  }",
  "})()"
].join('\n');

exports.execute = minstache.compile(execute);
