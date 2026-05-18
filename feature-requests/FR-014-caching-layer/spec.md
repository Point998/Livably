# FR-014 — Caching Layer (Reduce API Costs)

## What
Implement intelligent caching to reduce Google Maps API calls and improve response times.

## Problem
Currently:
- Every report regeneration makes fresh API calls (expensive)
- Same address searched multiple times = duplicate API calls
- No persistence of geocoding or place results
- High API costs as usage scales
- Slower response times (waiting for API calls)

## Requirements

### What to Cache
1. **Geocoding results** — address → lat/lng (rarely changes)
2. **Place search results** — nearest services (stable over weeks)
3. **Drive time calculations** — routes don't change hourly
4. **Full report data** — complete reports for quick re-viewing

### Cache Duration (TTL)
- **Geocoding:** 90 days (addresses don't move)
- **Places:** 7 days (businesses rarely close/open)
- **Drive times:** 24 hours (traffic patterns change daily)
- **Full reports:** 24 hours (comprehensive refresh)

### Cache Strategy
- **Memory cache** (fast, session-based) for immediate re-requests
- **File-based cache** (persistent) for cross-session reuse
- **Redis/Database** (optional, for production scale)

### Cache Invalidation
- Time-based expiration (TTL)
- Manual cache clear endpoint (`/admin/clear-cache`)
- Version-based (invalidate on app updates)

## Implementation Notes

### Simple File-Based Cache

**Cache utility (`src/cache.js`):**
```javascript
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, '../.cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

class Cache {
  constructor(namespace, ttlSeconds) {
    this.namespace = namespace;
    this.ttl = ttlSeconds;
  }
  
  getCacheKey(key) {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(CACHE_DIR, `${this.namespace}_${hash}.json`);
  }
  
  get(key) {
    const cacheFile = this.getCacheKey(key);
    
    if (!fs.existsSync(cacheFile)) {
      return null;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      
      // Check expiration
      if (Date.now() > data.expiresAt) {
        fs.unlinkSync(cacheFile);
        return null;
      }
      
      return data.value;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }
  
  set(key, value) {
    const cacheFile = this.getCacheKey(key);
    
    const data = {
      value,
      expiresAt: Date.now() + (this.ttl * 1000),
      createdAt: Date.now()
    };
    
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(data), 'utf8');
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }
  
  delete(key) {
    const cacheFile = this.getCacheKey(key);
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
    }
  }
  
  clear() {
    const files = fs.readdirSync(CACHE_DIR);
    files
      .filter(f => f.startsWith(`${this.namespace}_`))
      .forEach(f => fs.unlinkSync(path.join(CACHE_DIR, f)));
  }
}

// Create caches with different TTLs
const geocodeCache = new Cache('geocode', 60 * 60 * 24 * 90); // 90 days
const placesCache = new Cache('places', 60 * 60 * 24 * 7);    // 7 days
const driveTimeCache = new Cache('drivetime', 60 * 60 * 24);  // 24 hours
const reportCache = new Cache('report', 60 * 60 * 24);        // 24 hours

module.exports = {
  geocodeCache,
  placesCache,
  driveTimeCache,
  reportCache
};
```

### Integrate Caching into Functions

**Geocoding with cache:**
```javascript
const { geocodeCache } = require('./cache');

async function geocodeAddress(address) {
  const cacheKey = address.toLowerCase().trim();
  
  // Check cache first
  const cached = geocodeCache.get(cacheKey);
  if (cached) {
    console.log(`[CACHE HIT] Geocode: ${address}`);
    return cached;
  }
  
  console.log(`[CACHE MISS] Geocode: ${address}`);
  
  // Make API call
  const geocodeResponse = await googleMapsClient.geocode({
    params: { address, key: googleMapsApiKey },
  });
  
  const geoResults = geocodeResponse.data.results || [];
  if (!geoResults.length) {
    throw new Error('Unable to geocode the address.');
  }
  
  const location = geoResults[0].geometry.location;
  
  // Store in cache
  geocodeCache.set(cacheKey, location);
  
  return location;
}
```

**Place search with cache:**
```javascript
const { placesCache } = require('./cache');

async function findNearestGrocery(originLatLng) {
  const cacheKey = `grocery:${originLatLng}`;
  
  const cached = placesCache.get(cacheKey);
  if (cached) {
    console.log(`[CACHE HIT] Grocery: ${originLatLng}`);
    return cached;
  }
  
  console.log(`[CACHE MISS] Grocery: ${originLatLng}`);
  
  // ... existing place search logic
  
  const result = {
    name: bestStore.name,
    address: bestStore.formatted_address || bestStore.vicinity,
    location: bestStore.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, bestStore.geometry.location),
  };
  
  // Store in cache
  placesCache.set(cacheKey, result);
  
  return result;
}
```

**Drive time with cache:**
```javascript
const { driveTimeCache } = require('./cache');

async function getDriveTime(originLatLng, destinationLatLng) {
  const cacheKey = `${originLatLng}:${destinationLatLng}:${getNextTuesday8am()}`;
  
  const cached = driveTimeCache.get(cacheKey);
  if (cached) {
    console.log(`[CACHE HIT] Drive time: ${originLatLng} → ${destinationLatLng}`);
    return cached;
  }
  
  console.log(`[CACHE MISS] Drive time: ${originLatLng} → ${destinationLatLng}`);
  
  // ... existing distance matrix logic
  
  const minutes = Math.round((element.duration_in_traffic?.value ?? element.duration?.value) / 60);
  
  // Store in cache
  driveTimeCache.set(cacheKey, minutes);
  
  return minutes;
}
```

**Full report caching:**
```javascript
const { reportCache } = require('./cache');

app.get('/report', async (req, res) => {
  const address = req.query.address;
  
  if (!address) {
    return res.send(renderNoAddress());
  }
  
  const cacheKey = `report:${address.toLowerCase().trim()}`;
  
  // Check report cache
  const cachedReport = reportCache.get(cacheKey);
  if (cachedReport) {
    console.log(`[CACHE HIT] Full report: ${address}`);
    return res.send(cachedReport);
  }
  
  console.log(`[CACHE MISS] Full report: ${address}`);
  
  try {
    // Generate report (with individual caches inside)
    const reportData = await generateFullReport(address);
    const html = renderReport(reportData);
    
    // Cache the full HTML
    reportCache.set(cacheKey, html);
    
    return res.send(html);
  } catch (error) {
    return res.send(renderError(error.message));
  }
});
```

### Cache Management Endpoints

```javascript
// Clear all caches
app.post('/admin/clear-cache', (req, res) => {
  const { geocodeCache, placesCache, driveTimeCache, reportCache } = require('./cache');
  
  geocodeCache.clear();
  placesCache.clear();
  driveTimeCache.clear();
  reportCache.clear();
  
  res.json({ success: true, message: 'All caches cleared' });
});

// Clear specific cache
app.post('/admin/clear-cache/:type', (req, res) => {
  const { type } = req.params;
  const caches = { geocodeCache, placesCache, driveTimeCache, reportCache };
  
  if (caches[type]) {
    caches[type].clear();
    res.json({ success: true, message: `${type} cache cleared` });
  } else {
    res.status(400).json({ error: 'Invalid cache type' });
  }
});

// Cache statistics
app.get('/admin/cache-stats', (req, res) => {
  const fs = require('fs');
  const cacheDir = path.join(__dirname, '../.cache');
  
  if (!fs.existsSync(cacheDir)) {
    return res.json({ files: 0, size: 0 });
  }
  
  const files = fs.readdirSync(cacheDir);
  const stats = files.map(f => {
    const filePath = path.join(cacheDir, f);
    const stat = fs.statSync(filePath);
    return { name: f, size: stat.size };
  });
  
  const totalSize = stats.reduce((sum, s) => sum + s.size, 0);
  
  res.json({
    files: files.length,
    totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
    breakdown: {
      geocode: files.filter(f => f.startsWith('geocode_')).length,
      places: files.filter(f => f.startsWith('places_')).length,
      drivetime: files.filter(f => f.startsWith('drivetime_')).length,
      report: files.filter(f => f.startsWith('report_')).length
    }
  });
});
```

### .gitignore Update
```
# Cache directory
.cache/
```

## Acceptance Criteria
- [ ] Geocoding results cached for 90 days
- [ ] Place search results cached for 7 days
- [ ] Drive times cached for 24 hours
- [ ] Full reports cached for 24 hours
- [ ] Cache hits logged to console
- [ ] Cache miss triggers fresh API call
- [ ] Expired cache entries automatically purged
- [ ] `/admin/clear-cache` endpoint works
- [ ] `/admin/cache-stats` shows cache info
- [ ] `.cache/` directory gitignored
- [ ] Same address regenerated quickly (<1s vs 5-10s)

## Optional Enhancements (Future)
- [ ] Redis/Memcached for production
- [ ] In-memory LRU cache for hot paths
- [ ] Cache warming (pre-populate common addresses)
- [ ] Cache compression (gzip cached data)
- [ ] Cache metrics dashboard
- [ ] Distributed cache (multi-server)
- [ ] Smart invalidation (detect place changes)

## Testing Scenarios
1. **First search** → All cache misses, API calls made
2. **Immediate re-search** → All cache hits, no API calls
3. **Search after 25 hours** → Drive times miss, places hit
4. **Search after 8 days** → Places miss, geocode hit
5. **Clear cache** → All subsequent searches miss
6. **Different addresses** → Independent cache entries
7. **Same address, different case** → Cache still hits

## Performance Impact

**Without caching (3 searches of same address):**
- API calls: 6 × 3 = 18 calls
- Total time: ~30 seconds (3 × 10s)
- Cost: 18 API calls

**With caching (3 searches of same address):**
- First search: 6 API calls (10s)
- Second search: 0 API calls (<1s) ✓
- Third search: 0 API calls (<1s) ✓
- Cost: 6 API calls (saved 12 calls = 67% reduction)

## Dependencies
- Node.js `fs` module (built-in)
- Node.js `crypto` module (built-in)
- No new NPM packages required

**Optional upgrades:**
```bash
npm install node-cache  # In-memory LRU cache
npm install redis       # Redis client
```

## Estimated Effort
**Low-Medium** — 2-3 hours (file-based)
- Cache utility class
- Integrate into geocode function
- Integrate into places functions
- Integrate into drive time function
- Admin endpoints
- Testing cache hits/misses
- Documentation

**Medium** — 4-5 hours (Redis/production)
- Redis setup and connection
- Migration from file-based to Redis
- Error handling for cache failures
- Production deployment config
