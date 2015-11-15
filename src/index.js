
import os from 'os';
import path from 'path';
import debug from 'debug';
import { name as pkgName } from '../package.json';
import createConversion from './conversion';

const debugMe = debug(pkgName);

export default function(userOptions = {}) {
  let conversion;

  const optionsDefault = {
    timeout: 180000,
    numberOfWorkers: 2,
    chromeCommandLineSwitches: {},
    // namespace for tmp dir
    tmpDir: path.join(os.tmpDir(), pkgName + '-tmp-data'),
    strategy: 'electron-server'
  };

  const options = { ...optionsDefault, ...userOptions };

  debugMe('Creating a new conversion function with options:', options);

  // always set env var names for electron-workers (don't let the user override this config)
  options.hostEnvVarName = 'ELECTRON_WORKER_HOST';
  options.portEnvVarName = 'ELECTRON_WORKER_PORT';

  conversion = createConversion(options);

  return conversion;
}
