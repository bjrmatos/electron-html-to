
import os from 'os';
import path from 'path';
import debug from 'debug';
import assign from 'object-assign';
import { name as pkgName } from '../package.json';
import createConversion from './conversion';

const debugMe = debug(pkgName);

function conversionFactory(userOptions = {}) {
  let conversion;

  const optionsDefault = {
    timeout: 10000,
    numberOfWorkers: 2,
    chromeCommandLineSwitches: {},
    allowLocalFilesAccess: false,
    // namespace for tmp dir
    tmpDir: path.join(os.tmpDir(), pkgName + '-tmp-data'),
    strategy: 'electron-server'
  };

  const options = assign({}, optionsDefault, userOptions);

  if (Object.keys(options.chromeCommandLineSwitches).length === 0) {
    options.chromeCommandLineSwitches['ignore-certificate-errors'] = null;
  }

  debugMe('Creating a new conversion function with options:', options);

  // always set env var names for electron-workers (don't let the user override this config)
  options.hostEnvVarName = 'ELECTRON_WORKER_HOST';
  options.portEnvVarName = 'ELECTRON_WORKER_PORT';

  conversion = createConversion(options);

  return conversion;
}

conversionFactory.converters = {};
conversionFactory.converters.PDF = path.resolve(__dirname, './converters/pdf.js');

export default conversionFactory;
