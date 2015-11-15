
import fs from 'fs';
import mkdirp from 'mkdirp';

export default function saveFile(dirPath, filePath, content, cb) {
  mkdirp(dirPath, (err) => {
    if (err) {
      return cb(err);
    }

    fs.writeFile(filePath, content, cb);
  });
}
