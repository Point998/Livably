const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DRIVETIME_CELL_TTL_DAYS } = require('./utils/constants');

const CACHE_DIR = path.join(__dirname, '../.cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

class Cache {
  constructor(namespace, ttlSeconds) {
    this.namespace = namespace;
    this.ttl = ttlSeconds;
  }

  _filePath(key) {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(CACHE_DIR, `${this.namespace}_${hash}.json`);
  }

  get(key) {
    const file = this._filePath(key);
    if (!fs.existsSync(file)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Date.now() > data.expiresAt) {
        try { fs.unlinkSync(file); } catch {}
        return null;
      }
      return data.value;
    } catch {
      return null;
    }
  }

  set(key, value) {
    const file = this._filePath(key);
    try {
      fs.writeFileSync(file, JSON.stringify({ value, expiresAt: Date.now() + this.ttl * 1000, createdAt: Date.now() }), 'utf8');
    } catch {}
  }

  // A file belongs to this namespace only if it matches `<namespace>_<hash>.json`
  // exactly — the suffix must be a pure md5 hash. Guards against prefix collisions
  // (e.g. `drivetime` must not own `drivetime_cell_<hash>.json`).
  _ownsFile(filename) {
    const prefix = `${this.namespace}_`;
    if (!filename.startsWith(prefix)) return false;
    return /^[0-9a-f]+\.json$/.test(filename.slice(prefix.length));
  }

  clear() {
    try {
      fs.readdirSync(CACHE_DIR)
        .filter((f) => this._ownsFile(f))
        .forEach((f) => { try { fs.unlinkSync(path.join(CACHE_DIR, f)); } catch {} });
    } catch {}
  }

  stats() {
    try {
      return fs.readdirSync(CACHE_DIR).filter((f) => this._ownsFile(f)).length;
    } catch {
      return 0;
    }
  }
}

const geocodeCache  = new Cache('geocode',   60 * 60 * 24 * 90); // 90 days
const placesCache   = new Cache('places',    60 * 60 * 24 * 7);  // 7 days
const driveTimeCache = new Cache('drivetime', 60 * 60 * 24);     // 24 hours
// FR-058: cell-keyed lifestyle drive times surface as stable rungs, so they
// cache far longer than per-address exact times. Safety exactDriveMinutes uses
// driveTimeCache (24h) and is never cell-cached.
const driveTimeCellCache = new Cache('drivetime_cell', 60 * 60 * 24 * DRIVETIME_CELL_TTL_DAYS); // 14 days
// FR-034 enh 6: USGS Watershed Boundary Dataset is effectively static — cache long.
const watershedCache = new Cache('watershed', 60 * 60 * 24 * 90); // 90 days

function cacheStats() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    const totalSize = files.reduce((sum, f) => {
      try { return sum + fs.statSync(path.join(CACHE_DIR, f)).size; } catch { return sum; }
    }, 0);
    return {
      files: files.length,
      totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
      breakdown: {
        geocode:       files.filter((f) => geocodeCache._ownsFile(f)).length,
        places:        files.filter((f) => placesCache._ownsFile(f)).length,
        drivetime:     files.filter((f) => driveTimeCache._ownsFile(f)).length,
        drivetimeCell: files.filter((f) => driveTimeCellCache._ownsFile(f)).length,
        watershed:     files.filter((f) => watershedCache._ownsFile(f)).length,
      },
    };
  } catch {
    return { files: 0, totalSize: '0.00 KB', breakdown: { geocode: 0, places: 0, drivetime: 0 } };
  }
}

module.exports = { Cache, geocodeCache, placesCache, driveTimeCache, driveTimeCellCache, watershedCache, cacheStats, CACHE_DIR };
