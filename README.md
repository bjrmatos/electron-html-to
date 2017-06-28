electron-html-to
================

[![NPM Version](http://img.shields.io/npm/v/electron-html-to.svg?style=flat-square)](https://npmjs.com/package/electron-html-to)[![License](http://img.shields.io/npm/l/electron-html-to.svg?style=flat-square)](http://opensource.org/licenses/MIT)[![Build Status](https://travis-ci.org/bjrmatos/electron-html-to.png?branch=master)](https://travis-ci.org/bjrmatos/electron-html-to)

> **Highly scalable html conversion in scale**

This module let you convert a web page (html, css, js) in any format you want (via a converter function) using [electron](http://electron.atom.io/).

*Works in electron@>=0.36.1 including electron@1*

```js
var fs = require('fs'),
    convertFactory = require('electron-html-to');

var conversion = convertFactory({
  converterPath: convertFactory.converters.PDF
});

conversion({ html: '<h1>Hello World</h1>' }, function(err, result) {
  if (err) {
    return console.error(err);
  }

  console.log(result.numberOfPages);
  console.log(result.logs);
  result.stream.pipe(fs.createWriteStream('/path/to/anywhere.pdf'));
  conversion.kill(); // necessary if you use the electron-server strategy, see bellow for details
});
```

Built-in converters
-------------------

-	`convertFactory.converters.PDF` (html to pdf) -> when the conversion ends the `result` param will have `numberOfPages` (Number) and `stream` (Stream) properties.

Custom converters
-----------------

Converters are functions that run in the electron process, see the [pdf conversion implementation](https://github.com/bjrmatos/electron-html-to/blob/master/src/converters/pdf.js) for an example.

Global options
--------------

```js
var conversion = require('electron-html-to')({
  /* optional absolute path to a custom electron executable, if not passed we will try to detect the path of the electron executable installed */
  pathToElectron: '/path/to/custom/electron-executable',
  /* optional array of custom arguments to pass to the electron executable */
  electronArgs: ['--some-value=2', '--enable-some-behaviour'],
  /* required absolute path to the converter function to use, every conversion will use the converter specified  */
  converterPath: '/path/to/a/converter.js'
  /* number of allocated electron processes (when using electron-server strategy). defaults to 2 */
  numberOfWorkers: 2,
  /* time in ms to wait for worker ping response in order to be considered alive when using `electron-server` or `electron-ipc` strategy, see https://github.com/bjrmatos/electron-workers#options for details */
  pingTimeout: 100,
  /* timeout in ms for html conversion, when the timeout is reached, the conversion is cancelled. defaults to 180000ms */
  timeout: 5000,
  /* directory where are stored temporary html and pdf files, use something like npm package reap to clean this up */
  tmpDir: 'os/tmpdir',
  /* optional port range where to start electron server (when using electron-server strategy) */
  portLeftBoundary: 1000,
  portRightBoundary: 2000,
  /* optional hostname where to start electron server when using electron-server strategy) */
  host: '127.0.0.1',
  /* set to true to allow request using the file protocol (file:///). defaults to false */
  allowLocalFilesAccess: false,
  /* the collected console.log, console.error, console.warn messages are trimmed by default */
  maxLogEntrySize: 1000,
  /* optional chrome command line switches, see http://electron.atom.io/docs/v0.36.1/api/chrome-command-line-switches/ for details. defaults to { 'ignore-certificate-errors': null } */
  chromeCommandLineSwitches: {
    'disable-http-cache': null,
    'log-net-log': '/path/to/save'
  },
  /* use rather dedicated process for every conversion,
    dedicated-process strategy is quite slower but can solve some bugs
    with corporate proxy. for a description of `electron-server` and `electron-ipc` strategy see [electron-workers docs](https://github.com/bjrmatos/electron-workers/#modes). defaults to electron-ipc strategy */
  strategy: 'electron-ipc | electron-server | dedicated-process'
});
```

Local options
-------------

```js
conversion({
  html: '<h1>Hello world</h1>',
  url: 'http://jsreport.net', // set direct url instead of html
  delay: 0, // time in ms to wait before the conversion
  // boolean that specifies if we should collect logs calls (console.log, console.error, console.warn) in webpage
  // logs will be available as result.logs after the conversion
  // defaults to true
  collectLogs: true,
  waitForJS: true, // set to true to enable programmatically specify (via Javascript of the page) when the conversion starts (see Programmatic conversion section for an example)
  waitForJSVarName: 'MY_CUSTOM_VAR_NAME', // name of the variable that will be used as the conversion trigger, defaults to "ELECTRON_HTML_TO_READY" (see Programmatic pdf printing section for an example)
  userAgent: 'CUSTOM_USER_AGENT', // set a custom user agent to use in electron's browser window
  /* custom extra headers to load the html or url */
  extraHeaders: {
    'X-Foo': 'foo',
    'X-Bar': 'bar'
  },
  converterPath: '/path/to/a/converter.js', // absolute path to the converter function to use in the local conversion, if no specified the global converterPath option will be used

  // options for electron's browser window, see http://electron.atom.io/docs/v0.36.1/api/browser-window/ for details for each option.
  // allowed browser-window options
  browserWindow: {
    width: 600, // defaults to 600
    height: 600, // defaults to 600
    x: 0,
    y: 0,
    useContentSize: false,
    webPreferences: {
      nodeIntegration: false, // defaults to false
      partition: '',
      zoomFactor: 3.0,
      javascript: true, // defaults to true
      webSecurity: false, // defaults to false
      allowDisplayingInsecureContent: true,
      allowRunningInsecureContent: true,
      images: true,
      java: true,
      webgl: true,
      webaudio: true,
      plugins: ,
      experimentalFeatures: ,
      experimentalCanvasFeatures: ,
      overlayScrollbars: ,
      overlayFullscreenVideo: ,
      sharedWorker: ,
      directWrite:
    }
  },

  // options to the pdf converter function, see electron's printoToPDF function http://electron.atom.io/docs/v0.36.1/api/web-contents/#webcontents-printtopdf-options-callback for details for each option.
  // allowed printToPDF options
  pdf: {
    marginsType: 0,
    pageSize: 'A4',
    printBackground: false,
    landscape: false
  }
}, cb);
```

Local resources
---------------

You can add local files like `.css`, `.jpg` or `.js` files by setting the
`allowLocalFilesAccess` option to _true_. This option allow requests with the file protocol `file:///`.

### Example:

```html
<!-- index.html -->
<head>
	<link rel="stylesheet" href="/css/pdf.css">
</head>
<body>
	<h1 class="title">It Works!!</h1>
	<img src="/images/company_logo.jpg" title="MyLogo">
</body>
```

If your html doesn't have url in the form of `file://path/to/you/base/public/directory` you would need to transform paths from `/images/company_logo.jpg` to `file://path/to/you/base/public/directory/images/company_logo.jpg`.


```js
const fs = require('fs');
const convertFactory = require('electron-html-to');
fs.readFile('index.html', 'utf8', (err, htmlString) => {
  // add local path in case your HTML has relative paths
  htmlString = htmlString.replace(/href="|src="/g, match => {
    return match + 'file://path/to/you/base/public/directory';
  });
  const conversion = convertFactory({
    converterPath: convertFactory.converters.PDF,
    allowLocalFilesAccess: true
  });
  conversion({ html: htmlString }, (err, result) => {
    if (err) return console.error(err);
    result.stream.pipe(fs.createWriteStream('/path/to/anywhere.pdf'));
    conversion.kill(); // necessary if you use the electron-server strategy, see bellow for details
  });
});
```

Kill workers
------------

```js
// kill all electron workers when using electron-server strategy
conversion.kill();
```

Programmatic conversion
-----------------------

If you need to programmatic trigger the conversion process (because you need to calculate some values or do something async in your page before convert it) you can enable the `waitForJS` local option, when `waitForJS` is set to true the conversion will wait until you set a variable to true in your page, by default the name of the variable is `ELECTRON_HTML_TO_READY` but you can customize it via `waitForJSVarName` option.

Example
-------

local options:

```js
conversion({
  html: '<custom html here>',
  waitForJS: true
}, cb);
```

custom html:

```html
<h1></h1>
<script>
  // do some calculations or something async
  setTimeout(function() {
    window.ELECTRON_HTML_TO_READY = true; // this will start the conversion
  }, 500);
</script>
```

Debugging
---------

- To get more information (internal debugging logs of the module) about what's happening inside the conversion run your app with the `DEBUG` env var: `DEBUG=electron-html-to,electron-html-to:* node app.js` (on Windows use `set DEBUG=electron-html-to,electron-html-to:* && node app.js`). This will print out some additional information about what's going on.

- To see the electron process UI created (the visible electron window) and point stdout/stderr of the electron processes to console run your app with the `ELECTRON_HTML_TO_DEBUGGING` env var: `ELECTRON_HTML_TO_DEBUGGING=true node app.js` (on Windows use `set ELECTRON_HTML_TO_DEBUGGING=true && node app.js`).

- To only point stdout/stderr of the electron processes to console run your app with the `ELECTRON_HTML_TO_STDSTREAMS` env var: `ELECTRON_HTML_TO_STDSTREAMS=true node app.js` (on Windows use `set ELECTRON_HTML_TO_STDSTREAMS=true && node app.js`).

- To enable low level messages (chromium logs) of the electron processes run your app with the [`ELECTRON_ENABLE_LOGGING`](https://electron.atom.io/docs/api/chrome-command-line-switches/#enable-logging) env var: `ELECTRON_ENABLE_LOGGING=true node app.js` (on Windows use `set ELECTRON_ENABLE_LOGGING=true && node app.js`).

Requirements
------------

-	Install [electron](http://electron.atom.io/) >= 0.36.1 including electron@1, the easy way to install
electron in your app is `npm install electron --save` or `npm install electron-prebuilt --save`

Troubleshooting
---------------

#### Using electron in single core machines

If you are using a machine with a single-core processor you will probably experience a high CPU usage when doing any conversion (97% in most cases and the usage is worse when using Windows), this is because a limitation in electron when it is being used on single core machines, unfortunately the only way to overcome this is to upgrade your machine to a processor with more cores (a processor with two cores is fine).
more info: [issue1](https://github.com/Microsoft/vscode/issues/17097), [issue2](https://github.com/Microsoft/vscode/issues/22724)

#### env: node: No such file or directory when using electron-prebuilt and nvm

If you are using node with [nvm](https://github.com/creationix/nvm) and you have installed electron with `npm install -g electron-prebuilt` you probably will see an error or log with `env: node: No such file or directory`, this is because the electron executable installed by `electron-prebuilt` is a node CLI spawning the real electron executable internally, since nvm don't install/symlink node to `/usr/bin/env/node` when the electron executable installed by `electron-prebuilt` tries to run, it will fail because `node` won't be found in that context..

Solution:

1.- Install `electron-prebuilt` as a dependency in your app, this is the option **recommended** because you probably want to ensure your app always run with the exact version you tested it, and probably you don't want to install electron globally in your system.

2.- You can make a symlink to `/usr/bin/env/node` but this is **not recommended** by nvm authors, because you will loose all the power that nvm brings.

3.- Put the path to the **real electron executable** in your `$PATH`.

License
-------

See [license](https://github.com/bjrmatos/electron-html-to/blob/master/LICENSE)
