# electron-html-to
[![NPM Version](http://img.shields.io/npm/v/electron-html-to.svg?style=flat-square)](https://npmjs.com/package/electron-html-to)
[![License](http://img.shields.io/npm/l/electron-html-to.svg?style=flat-square)](http://opensource.org/licenses/MIT)
[![Build Status](https://travis-ci.org/bjrmatos/electron-html-to.png?branch=master)](https://travis-ci.org/bjrmatos/electron-html-to)

> **Highly scalable html conversion in scale**

This module let you convert a web page (html, css, js) in any format you want (via a converter function) using [electron](http://electron.atom.io/).

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
  result.stream.pipe(fs.createWriteStream('/path/to/anywhere.pdf'));
  conversion.kill(); // necessary if you use the electron-server strategy, see bellow for details
});
```

## Built-in converters

- `convertFactory.converters.PDF` (html to pdf) -> when the conversion ends the `result` param will have `numberOfPages` (Number) and `stream` (Stream) properties.

## Custom converters

Converters are functions that run in the electron process, see the [pdf conversion implementation](https://github.com/bjrmatos/electron-html-to/blob/master/src/converters/pdf.js) for an example.

## Global options

```js
var conversion = require('electron-html-to')({
  /* required absolute path to the converter function to use, every conversion will use the converter specified  */
  converterPath: '/path/to/a/converter.js'
  /* number of allocated electron processes (when using electron-server strategy). defaults to 2 */
  numberOfWorkers: 2,
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
  /* optional chrome command line switches, see http://electron.atom.io/docs/v0.35.0/api/chrome-command-line-switches/ for details. defaults to { 'ignore-certificate-errors': null } */
  chromeCommandLineSwitches: { 
    'disable-http-cache': null, 
    'log-net-log': '/path/to/save' 
  },
  /* use rather dedicated process for every conversion, 
    dedicated-process strategy is quite slower but can solve some bugs 
    with corporate proxy. defaults to electron-server strategy */ 
  strategy: 'electron-server | dedicated-process'
});
```

## Local options

```js
conversion({
  html: '<h1>Hello world</h1>',
  url: 'http://jsreport.net', // set direct url instead of html
  delay: 0, // time in ms to wait before the conversion
  waitForJS: true, // set to true to enable programmatically specify (via Javascript of the page) when the conversion starts (see Programmatic conversion section for an example)
  waitForJSVarName: 'MY_CUSTOM_VAR_NAME', // name of the variable that will be used as the conversion trigger, defaults to "ELECTRON_HTML_TO_READY" (see Programmatic pdf printing section for an example)
  userAgent: 'CUSTOM_USER_AGENT', // set a custom user agent to use in electron's browser window
  converterPath: '/path/to/a/converter.js', // absolute path to the converter function to use in the local conversion, if no specified the global converterPath option will be used
  
  // options for electron's browser window, see http://electron.atom.io/docs/v0.35.0/api/browser-window/ for details for each option.
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

  // options to the pdf converter function, see electron's printoToPDF function http://electron.atom.io/docs/v0.35.0/api/web-contents/#webcontents-printtopdf-options-callback for details for each option.
  // allowed printToPDF options
  pdf: {
    marginsType: 0,
    pageSize: 'A4',
    printBackground: false,
    landscape: false
  }
}, cb);
```

## Kill workers
```js
// kill all electron workers when using electron-server strategy
conversion.kill();
```

## Programmatic conversion
If you need to programmatic trigger the conversion process (because you need to calculate some values or do something async in your page before convert it) you can enable the `waitForJS` local option, when `waitForJS` is set to true the conversion will wait until you set a variable to true in your page, by default the name of the variable is `ELECTRON_HTML_TO_READY` but you can customize it via `waitForJSVarName` option.

**Example:**

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

## Debugging

To get more information about what's happening inside the conversion run your app with the `DEBUG` flag. `DEBUG=electron-html-to,electron-html-to:* node app.js` (on Windows use `set DEBUG=electron-html-to,electron-html-to:* & node app.js`).

This will print out some additional information about what's going on.

## Requeriments

- Install [electron](http://electron.atom.io/) > 0.35.x, the easy way to install electron in your app is `npm install electron-prebuilt --save`

## Troubleshooting

If you are using node with [nvm](https://github.com/creationix/nvm) and you have installed electron with `npm install -g electron-prebuilt` you probably will see an error or log with `env: node: No such file or directory`, this is because the electron executable installed by `electron-prebuilt` is a node CLI spawning the real electron executable internally, since nvm don't install/symlink node to `/usr/bin/env/node` when the electron executable installed by `electron-prebuilt` tries to run, it will fail because `node` won't be found in that context..

*Solution:* 

1.- Install `electron-prebuilt` as a dependency in your app, this is the option **recommended** because you probably want to ensure your app always run with the exact version you tested it, and probably you dotn't want to install electron globally in your system.

2.- You can make a symlink to `/usr/bin/env/node` but this is **not recommended** by nvm authors, because you will loose all the power that nvm brings.

3.- Put the path to the **real electron executable** in your `$PATH`.

## License
See [license](https://github.com/bjrmatos/electron-html-to/blob/master/LICENSE)
