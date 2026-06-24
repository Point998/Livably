'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Atomic write: write a temp sibling then rename over the target. rename(2) is
// atomic on the same filesystem, so a reader never sees a torn file and a crash
// mid-write leaves the previous version intact.
async function atomicWrite(filePath, data) {
  const tmp = `${filePath}.tmp.${crypto.randomBytes(4).toString('hex')}`;
  await fsp.writeFile(tmp, data, 'utf8');
  await fsp.rename(tmp, filePath);
}

// One file per report (data/reports/<id>.json). No shared map => no read-modify-write
// race / lost updates, and a `get` reads one small file instead of parsing every
// report (incl. its HTML) on every access. The class shape is the seam a future
// network backend (PostgresReportStore) implements unchanged.
class FileReportStore {
  constructor(baseDir = process.env.LIVABLY_REPORTS_DIR || path.join(__dirname, '../../data/reports')) {
    this.baseDir = baseDir;
    this.legacyFile = path.join(baseDir, '..', 'reports.json');
    this._migrated = null; // set in Task 2
  }

  _file(id) { return path.join(this.baseDir, `${id}.json`); }

  async ensureMigrated() { await fsp.mkdir(this.baseDir, { recursive: true }); } // replaced in Task 2

  async mintId() {
    await this.ensureMigrated();
    for (;;) {
      const id = crypto.randomBytes(4).toString('hex'); // 8 hex chars
      try {
        await fsp.writeFile(this._file(id), '{}', { flag: 'wx' }); // exclusive create = atomic reservation
        return id;
      } catch (err) {
        if (err.code === 'EEXIST') continue;
        throw err;
      }
    }
  }

  async put(id, record) {
    await this.ensureMigrated();
    await atomicWrite(this._file(id), JSON.stringify(record, null, 2));
  }

  async get(id) {
    await this.ensureMigrated();
    try {
      const rec = JSON.parse(await fsp.readFile(this._file(id), 'utf8'));
      // An empty reservation stub ('{}') is not yet a usable record.
      return rec && Object.keys(rec).length ? rec : null;
    } catch {
      return null; // ENOENT or parse error -> self-heal to null (never throw into a request)
    }
  }

  async touch(id) {
    const rec = await this.get(id);
    if (!rec) return false;
    rec.lastAccessed = new Date().toISOString();
    await this.put(id, rec);
    return true;
  }
}

module.exports = { atomicWrite, FileReportStore };
