const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let initialized = false;
const pending = new Set();

function isTargetFile(filePath) {
  if (!filePath) return false;
  const resolved = path.resolve(filePath);
  return (
    resolved.includes(`${path.sep}data${path.sep}`) &&
    resolved.endsWith('.json')
  );
}

function scheduleSync(filePath, payload) {
  if (!initialized || !isTargetFile(filePath)) return;
  if (mongoose.connection.readyState !== 1) return;

  const key = path.resolve(filePath);
  if (pending.has(key)) return;
  pending.add(key);

  queueMicrotask(async () => {
    try {
      await syncFile(key, payload);
    } catch (err) {
      console.error(`[MongoSync] Failed to sync ${path.basename(key)}:`, err.message);
    } finally {
      pending.delete(key);
    }
  });
}

async function syncFile(filePath, payload) {
  let jsonData = null;
  try {
    if (payload !== undefined) {
      if (Buffer.isBuffer(payload)) {
        payload = payload.toString('utf8');
      }
      if (typeof payload === 'string') {
        jsonData = JSON.parse(payload || 'null');
      } else {
        jsonData = payload;
      }
    }
  } catch {
    jsonData = null;
  }

  if (jsonData === null) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      jsonData = JSON.parse(content || 'null');
    } catch {
      return;
    }
  }

  if (jsonData === null || jsonData === undefined) return;

  const collectionName = path.basename(filePath, '.json');
  const db = mongoose.connection.db;
  if (!db) return;
  const collection = db.collection(collectionName);

  if (Array.isArray(jsonData)) {
    await collection.deleteMany({});
    if (jsonData.length) {
      const docs = jsonData.map(doc => ({ ...doc }));
      await collection.insertMany(docs, { ordered: false });
    }
  } else if (typeof jsonData === 'object') {
    await collection.deleteMany({});
    await collection.insertOne({ ...jsonData });
  }
}

async function seedExistingData(dataDir) {
  try {
    const entries = fs.readdirSync(dataDir);
    for (const entry of entries) {
      const fullPath = path.join(dataDir, entry);
      if (isTargetFile(fullPath)) {
        await syncFile(fullPath);
      }
    }
  } catch (err) {
    console.error('[MongoSync] Seed error:', err.message);
  }
}

function hookFsWrite() {
  if (initialized) return;
  initialized = true;

  const originalWriteFileSync = fs.writeFileSync;
  fs.writeFileSync = function patchedWriteFileSync(file, data, options) {
    originalWriteFileSync.call(fs, file, data, options);
    scheduleSync(file, data);
  };

  const originalWriteJsonSync = fs.writeJsonSync;
  if (typeof originalWriteJsonSync === 'function') {
    fs.writeJsonSync = function patchedWriteJsonSync(file, data, options) {
      originalWriteJsonSync.call(fs, file, data, options);
      scheduleSync(file, JSON.stringify(data));
    };
  }
}

function initMongoSync() {
  if (initialized) return;
  hookFsWrite();
  const dataDir = path.join(__dirname, 'data');
  seedExistingData(dataDir);
}

module.exports = { initMongoSync };

