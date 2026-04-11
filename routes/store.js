// routes/_store.js
const fs = require('fs-extra');

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return fs.readJsonSync(file);
  } catch (err) {
    console.error('readJsonSafe error', err);
    return null;
  }
}

function writeJsonSafe(file, data) {
  try {
    fs.writeJsonSync(file, data, { spaces: 2 });
  } catch (err) {
    console.error('writeJsonSafe error', err);
  }
}

module.exports = {
  readJsonSafe,
  writeJsonSafe
};
