const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

  clear() {
    try {
      fs.readdirSync(CACHE_DIR)
        .filter((f) => f.startsWith(`${this.namespace}_`))
        .forEach((f) => { try { fs.unlinkSync(path.join(CACHE_DIR, f)); } catch {} });
    } catch {}
  }

  stats() {
    try {
      return fs.readdirSync(CACHE_DIR).filter((f) => f.startsWith(`${this.namespace}_`)).length;
    } catch {
      return 0;
    }
  }
}

const geocodeCache  = new Cache('geocode',   60 * 60 * 24 * 90); // 90 days
const placesCache   = new Cache('places',    60 * 60 * 24 * 7);  // 7 days
const driveTimeCache = new Cache('drivetime', 60 * 60 * 24);     // 24 hours

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
        geocode:   files.filter((f) => f.startsWith('geocode_')).length,
        places:    files.filter((f) => f.startsWith('places_')).length,
        drivetime: files.filter((f) => f.startsWith('drivetime_')).length,
      },
    };
  } catch {
    return { files: 0, totalSize: '0.00 KB', breakdown: { geocode: 0, places: 0, drivetime: 0 } };
  }
}

module.exports = { geocodeCache, placesCache, driveTimeCache, cacheStats, CACHE_DIR };
