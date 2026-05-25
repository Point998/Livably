# FR-036 — Phase 2 Specification: Utilities Extraction
*Phase 2 of the architectural rebuild. No code changes in this phase.*
*May 2026*

---

## Purpose

Define the exact structure, exports, and migration strategy for Phase 1 of the architectural rebuild: extracting utility functions and hardcoded constants from `app.js`, `premium.js`, and `development-discovery.js` into `src/utils/`.

Phase 1 delivers **zero behavior changes**. Same inputs, same outputs. The goal is to give Phases 2–7 a stable foundation — named constants, shared utility functions, and a clear dependency graph.

---

## File Structure

```
src/utils/
  time.js        ← time calculation utilities
  text.js        ← string formatting and HTML escaping
  geo.js         ← geographic math
  state.js       ← US state data
  constants.js   ← all hardcoded arrays, objects, thresholds, magic numbers
```

Five files. Nothing else in `src/utils/` during Phase 1.

Import dependency rule: **utils/ files never import from src/**. They only import from each other, and only when strictly necessary (text.js may import STATE_ABBRS from state.js). constants.js imports from nothing.

---

## File 1: `src/utils/time.js`

### Purpose
Date/time calculations for API departure-time parameters. Currently in `app.js:73–109`.

### Exports

```js
/**
 * Returns the Unix timestamp (seconds) for the next Tuesday at 8:00am local time.
 * Used as the departure_time parameter for Distance Matrix API calls.
 * This is the canonical Livably "drive time" measurement moment.
 */
function getNextTuesday8am()

/**
 * Returns the Unix timestamp (seconds) for the next occurrence of targetDay at hour.
 * @param {number} targetDay - Day of week (0=Sun, 1=Mon ... 6=Sat)
 * @param {number} hour      - Hour in 24h format (e.g. 8, 12, 17)
 * @returns {number} Unix timestamp in seconds
 */
function getNextDayAt(targetDay, hour)

module.exports = { getNextTuesday8am, getNextDayAt };
```

### Callers after extraction
- `app.js` — `getDriveTime` uses `getNextTuesday8am()`
- `app.js` — `getTrafficVariations` uses `getNextDayAt()` for Mon/Sat slots

### No constants to define here
The traffic variation time slots (Mon 8am, Mon 12pm, Mon 5pm, Sat 10am) are configuration for `getTrafficVariations` and belong in `constants.js`. See `TRAFFIC_VARIATION_SLOTS` below.

---

## File 2: `src/utils/text.js`

### Purpose
String formatting, HTML escaping, address parsing. Currently split across `app.js:764–800`, `app.js:2243–2250`, and `premium.js:24–37`.

### Exports

```js
/**
 * Escapes HTML special characters. Canonical function replacing both
 * escapeHtml() (app.js) and esc() (premium.js). All callers use this name.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str)

/**
 * Converts drive time in minutes to a human-readable string.
 * Returns "X min" for < 60, "X hr Y min" for >= 60.
 * @param {number} minutes
 * @returns {string}
 */
function formatDriveTime(minutes)

/**
 * Title-cases an address string. State abbreviations (from STATE_ABBRS) are
 * preserved in uppercase. Example: "123 main st, georgetown, ky" → "123 Main St, Georgetown, KY"
 * @param {string} str
 * @returns {string}
 */
function toTitleCase(str)

/**
 * Splits a full address string at the first comma.
 * @param {string} address - Full address, e.g. "123 Main St, Georgetown, KY 40324"
 * @returns {{ street: string, cityState: string }}
 */
function parseAddressParts(address)

/**
 * Returns today's date formatted for report headers.
 * @returns {string} e.g. "May 25, 2026"
 */
function formatResearchDate()

/**
 * Formats a number as a dollar amount with commas. No decimals.
 * @param {number} n
 * @returns {string} e.g. "$1,234"
 */
function formatMoney(n)

/**
 * Converts text to kebab-case for use in filenames.
 * @param {string} text
 * @returns {string} e.g. "Georgetown KY" → "georgetown-ky"
 */
function slugify(text)

/**
 * Returns today's date in YYYY-MM-DD format for use in filenames.
 * @returns {string} e.g. "2026-05-25"
 */
function getDateSlug()

module.exports = {
  escapeHtml,
  formatDriveTime,
  toTitleCase,
  parseAddressParts,
  formatResearchDate,
  formatMoney,
  slugify,
  getDateSlug,
};
```

### Internal dependency
`toTitleCase` needs `STATE_ABBRS` to preserve state abbreviation casing. Import it:

```js
const { STATE_ABBRS } = require('./state');
```

This is the only cross-utils import in Phase 1. It is one-directional and creates no cycle.

---

## File 3: `src/utils/geo.js`

### Purpose
Geographic math — straight-line distance calculations. Currently `premium.js:9–22`.

### Exports

```js
/**
 * Returns the great-circle distance in miles between two lat/lng points.
 * Uses the Haversine formula. For display labels only — not a substitute
 * for Google Distance Matrix drive times.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in miles
 */
function haversineDistance(lat1, lng1, lat2, lng2)

module.exports = { haversineDistance };
```

### Callers after extraction
`premium.js` — approximately 10 call sites for `distanceMiles` fields across flight path, rail proximity, park distance, etc.

---

## File 4: `src/utils/state.js`

### Purpose
US state reference data. Currently just the `STATE_ABBRS` Set in `app.js:776`. The architecture plan calls for a full name↔abbreviation lookup — that is **deferred to Phase 2+**. Phase 1 only migrates what currently exists.

### Exports

```js
/**
 * Set of all 51 US state/territory abbreviations (50 states + DC).
 * Used by toTitleCase() to preserve state abbreviation uppercase casing.
 */
const STATE_ABBRS = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

module.exports = { STATE_ABBRS };
```

### Not included in Phase 1
- Full state name → abbreviation map
- Abbreviation → full name map
- State FIPS code map

These will be added in later phases as modules need them.

---

## File 5: `src/utils/constants.js`

### Purpose
Single source of truth for all hardcoded arrays, objects, thresholds, search radii, candidate counts, and categorical data currently buried in function bodies across `app.js`, `premium.js`, and `development-discovery.js`.

This file imports from nothing. No other utils/ file depends on it — only src/ files import from it.

### Naming convention
All exports are `SCREAMING_SNAKE_CASE`. Group-prefixed by domain.

---

### Search Radii (meters unless noted)

```js
const GROCERY_SEARCH_RADIUS_M = 8000;
const HOSPITAL_SEARCH_RADIUS_M = 50000;
const ELEMENTARY_SCHOOL_SEARCH_RADIUS_M = 15000;
const AIRPORT_SEARCH_RADIUS_M = 32000;
const AIRPORT_MAX_DISTANCE_MILES = 20;
const WALKABILITY_SEARCH_RADIUS_M = 800;
const DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M = 2400;
const OSM_ROAD_NOISE_RADIUS_M = 4000;
const OSM_RAIL_RADIUS_M = 4800;
const OSM_LANDUSE_RADIUS_M = 800;
const WATER_QUALITY_SEARCH_RADIUS_MILES = 10;

// iNaturalist — in km, not meters
const INAT_NATIVE_PLANTS_RADIUS_KM = 16;
const INAT_INVASIVE_PLANTS_RADIUS_KM = 32;
const INAT_WILDLIFE_RADIUS_KM = 16;
const INAT_BIRDS_RADIUS_KM = 16;
```

### Result Candidate Counts

```js
const GROCERY_CANDIDATE_COUNT = 8;
const HOSPITAL_CANDIDATE_COUNT = 5;
const COFFEE_SHOP_CANDIDATE_COUNT = 5;
const INAT_NATIVE_PLANTS_PER_PAGE = 30;
const INAT_INVASIVE_PLANTS_PER_PAGE = 25;
const INAT_WILDLIFE_PER_PAGE = 15;
const INAT_BIRDS_PER_PAGE = 20;
```

### Highway Thresholds

```js
const HIGHWAY_MAX_DRIVE_MINUTES = 20;       // Include interstates within this drive time
const HIGHWAY_INTERCHANGE_MAX_MINUTES = 50; // Fallback: show closest if nothing within 20 min
```

### Drive Time Thresholds

```js
// Traffic variation departure slots used by getTrafficVariations
// Each entry: { label, targetDay (0=Sun), hour (24h) }
const TRAFFIC_VARIATION_SLOTS = [
  { label: 'Mon morning rush',   targetDay: 1, hour: 8  },
  { label: 'Mon midday',         targetDay: 1, hour: 12 },
  { label: 'Mon evening rush',   targetDay: 1, hour: 17 },
  { label: 'Sat morning',        targetDay: 6, hour: 10 },
];
```

### Response Time Estimates

```js
const RESPONSE_SPEED_MPH = { police: 30, fire: 35 };
const RESPONSE_DISPATCH_MINUTES = { police: 2, fire: 1.5 };
const RESPONSE_TIME_THRESHOLDS = {
  police: { excellent: 5, good: 10, fair: 15 },
  fire:   { excellent: 5, good:  8, fair: 12 },
};
```

### AQI Thresholds

```js
const AQI_THRESHOLDS = [
  { max: 50,  label: 'Good',                  color: '#00e400' },
  { max: 100, label: 'Moderate',              color: '#ffff00' },
  { max: 150, label: 'Unhealthy for Sensitive Groups', color: '#ff7e00' },
  { max: 200, label: 'Unhealthy',             color: '#ff0000' },
  { max: Infinity, label: 'Very Unhealthy',   color: '#8f3f97' },
];
```

### Noise Thresholds

```js
const DNL_THRESHOLDS = [
  { max: 45, label: 'Quiet' },
  { max: 55, label: 'Moderate' },
  { max: 65, label: 'Loud' },
  { max: 70, label: 'Very Loud' },
  { max: Infinity, label: 'Extremely Loud' },
];

// Highway noise fallback (when no OSM data available)
// Maps drive time (min) to estimated DNL dB
const HIGHWAY_NOISE_ESTIMATE = [
  { maxMinutes: 5,  estimatedDB: 65 },
  { maxMinutes: 15, estimatedDB: 55 },
  { maxMinutes: Infinity, estimatedDB: 45 },
];
```

### Bortle Scale (Light Pollution)

```js
const BORTLE_SCALE = [
  { max: 400,  bortle: 9, label: 'Inner city sky' },
  { max: 1200, bortle: 8, label: 'City sky' },
  { max: 3000, bortle: 7, label: 'Suburban/urban transition' },
  { max: 6000, bortle: 6, label: 'Bright suburban sky' },
  { max: 15000, bortle: 5, label: 'Suburban sky' },
  { max: 45000, bortle: 4, label: 'Rural/suburban transition' },
  { max: 150000, bortle: 3, label: 'Rural sky' },
  { max: Infinity, bortle: 2, label: 'Truly dark sky' },
];
```

### Flood Zone Classifications

```js
// FEMA flood zone codes → risk level and insurance requirement
const FEMA_FLOOD_ZONES = {
  'A':   { risk: 'high',     insurance: true,  label: 'Special Flood Hazard Area' },
  'AE':  { risk: 'high',     insurance: true,  label: 'Special Flood Hazard Area' },
  'AH':  { risk: 'high',     insurance: true,  label: 'Special Flood Hazard Area (ponding)' },
  'AO':  { risk: 'high',     insurance: true,  label: 'Special Flood Hazard Area (shallow)' },
  'A99': { risk: 'high',     insurance: true,  label: 'Area with flood protection under construction' },
  'V':   { risk: 'high',     insurance: true,  label: 'Coastal high hazard' },
  'VE':  { risk: 'high',     insurance: true,  label: 'Coastal high hazard' },
  'X':   { risk: 'low',      insurance: false, label: 'Minimal flood risk' },
  'B':   { risk: 'moderate', insurance: false, label: 'Moderate flood risk' },
  'C':   { risk: 'low',      insurance: false, label: 'Minimal flood risk' },
};
```

### Radon Zones

```js
// EPA radon zone by state FIPS code. Zone 1 = highest risk, 3 = lowest.
const RADON_ZONE_BY_STATE = { /* ... exact content from premium.js:876 ... */ };
```

### Tornado Risk Tiers

```js
// NOAA historical tornado data by state
const TORNADO_TIER = {
  high:     ['OK', 'KS', 'TX', 'NE', 'SD', 'ND', 'IA', 'MO', 'AR', 'LA', 'MS', 'AL', 'TN', 'IL', 'IN'],
  moderate: ['CO', 'MN', 'WI', 'OH', 'KY', 'GA', 'FL', 'SC', 'NC', 'WY', 'MT', 'ID'],
  low:      ['CA', 'OR', 'WA', 'NV', 'AZ', 'UT', 'NM', 'AK', 'HI', 'ME', 'VT', 'NH', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'MD', 'DE', 'DC', 'VA', 'WV', 'MI'],
};
```

### Frost Date Table

```js
// USDA hardiness zone → average last frost (spring) and first frost (fall) dates
// 26 entries — zones 1a through 13b
const FROST_DATE_TABLE = { /* ... exact content from premium.js:1130 ... */ };
```

### State Financial Tables

```js
const STATE_TAX_RATES        = { /* ... 52-entry from premium.js:217 ... */ };
const STATE_INSURANCE_ANNUAL = { /* ... 52-entry from premium.js:227 ... */ };
const STATE_UTILITIES_MONTHLY = { /* ... 52-entry from premium.js:237 ... */ };
const STATE_HOMESTEAD        = { /* ... 12-entry from premium.js:247 ... */ };
const STATE_EXTENSION        = { /* ... 51-entry from premium.js:1197 ... */ };
```

### Wildlife Filter Lists

```js
const NATIVE_PLANT_EXCLUDE       = new Set([/* 10 genera/species from premium.js:1167 */]);
const NATIVE_PLANT_EXCLUDE_NAMES = [/* 9 common names from premium.js:1172 */];
const BENIGN_INTRODUCED          = new Set([/* 22 introduced species from premium.js:1178 */]);
const DOMESTIC_MAMMALS           = new Set([/* 3 entries from premium.js:1192 */]);
```

### Google Places Type Filters

```js
const GROCERY_EXCLUDED_TYPES = ['gas_station', 'convenience_store', 'lodging'];

const PARK_EXCLUDED_TYPES = ['local_government_office', 'lawyer', 'insurance_agency', 'political'];
const PARK_LEISURE_TYPES  = ['park', 'natural_feature', 'campground' /* ... */];

const SCHOOL_PLACE_TYPES = new Set([/* from app.js:580 */]);
const SCHOOL_NAME_TERMS  = /* regex from app.js:581 */;

const ELEMENTARY_SCHOOL_EXCLUSIONS = ['preschool', 'pre-school', 'daycare', 'day care', 'montessori', 'private'];

const COMMERCIAL_DEV_TYPES = [/* 6 entries from premium.js:1074 */];
const WALK_TYPES           = [/* 5 categories from premium.js:291 */];
```

### Airport Filters

```js
const NON_AIRPORT_RE = /paraglid|skydiv|ultralight|glider|balloon|heliport/i; // from premium.js:633
const AIRPORT_RE     = /airport|airfield|airpark|air park/i;                  // from premium.js:635
```

### Broadband Technology Codes

```js
// FCC technology code → human-readable label
const BROADBAND_TECH_CODES = { /* 12 entries from premium.js:1627 */ };
```

### Interstate List

```js
// All 59 US interstates by standard designation. Used by highway on-ramp search.
const INTERSTATE_LIST = [
  'I-5', 'I-8', 'I-10', 'I-12', 'I-15', 'I-16', 'I-17', 'I-19',
  'I-20', 'I-22', 'I-24', 'I-25', 'I-26', 'I-27', 'I-29', 'I-30',
  'I-35', 'I-37', 'I-39', 'I-40', 'I-43', 'I-44', 'I-45', 'I-49',
  'I-55', 'I-57', 'I-59', 'I-64', 'I-65', 'I-66', 'I-68', 'I-69',
  'I-70', 'I-71', 'I-72', 'I-73', 'I-74', 'I-75', 'I-76', 'I-77',
  'I-78', 'I-79', 'I-80', 'I-81', 'I-82', 'I-83', 'I-84', 'I-85',
  'I-86', 'I-87', 'I-88', 'I-89', 'I-90', 'I-91', 'I-93', 'I-94',
  'I-95', 'I-96', 'I-97',
];
```

### Report UI Constants

```js
const CUSTOM_DEST_ICONS = { /* from app.js:1258 */ };
const ERROR_ICONS        = { /* from app.js:1576 */ };
const MAX_CONCURRENT_PDFS = 3;
```

### OpenStreetMap Endpoints

```js
const OVERPASS_ENDPOINTS = [/* 4 endpoints from premium.js:677 */];
```

### Development Discovery Constants

```js
const DEV_CACHE_TTL_MS    = 7 * 24 * 60 * 60 * 1000;  // 7 days
const DEV_REQUEST_DELAY_MS = 1200;                       // ms between RSS fetches
const DEV_MAX_ARTICLE_AGE  = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years
const DEV_TYPE_MAP   = { /* 8 entries from development-discovery.js:24 */ };
const DEV_STATUS_MAP = { /* 4 entries from development-discovery.js:75 */ };
```

### Full export list

```js
module.exports = {
  // Search radii
  GROCERY_SEARCH_RADIUS_M,
  HOSPITAL_SEARCH_RADIUS_M,
  ELEMENTARY_SCHOOL_SEARCH_RADIUS_M,
  AIRPORT_SEARCH_RADIUS_M,
  AIRPORT_MAX_DISTANCE_MILES,
  WALKABILITY_SEARCH_RADIUS_M,
  DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M,
  OSM_ROAD_NOISE_RADIUS_M,
  OSM_RAIL_RADIUS_M,
  OSM_LANDUSE_RADIUS_M,
  WATER_QUALITY_SEARCH_RADIUS_MILES,
  INAT_NATIVE_PLANTS_RADIUS_KM,
  INAT_INVASIVE_PLANTS_RADIUS_KM,
  INAT_WILDLIFE_RADIUS_KM,
  INAT_BIRDS_RADIUS_KM,
  // Candidate counts
  GROCERY_CANDIDATE_COUNT,
  HOSPITAL_CANDIDATE_COUNT,
  COFFEE_SHOP_CANDIDATE_COUNT,
  INAT_NATIVE_PLANTS_PER_PAGE,
  INAT_INVASIVE_PLANTS_PER_PAGE,
  INAT_WILDLIFE_PER_PAGE,
  INAT_BIRDS_PER_PAGE,
  // Highway
  HIGHWAY_MAX_DRIVE_MINUTES,
  HIGHWAY_INTERCHANGE_MAX_MINUTES,
  // Traffic
  TRAFFIC_VARIATION_SLOTS,
  // Response times
  RESPONSE_SPEED_MPH,
  RESPONSE_DISPATCH_MINUTES,
  RESPONSE_TIME_THRESHOLDS,
  // Environmental thresholds
  AQI_THRESHOLDS,
  DNL_THRESHOLDS,
  HIGHWAY_NOISE_ESTIMATE,
  BORTLE_SCALE,
  FEMA_FLOOD_ZONES,
  RADON_ZONE_BY_STATE,
  TORNADO_TIER,
  // Garden/nature
  FROST_DATE_TABLE,
  NATIVE_PLANT_EXCLUDE,
  NATIVE_PLANT_EXCLUDE_NAMES,
  BENIGN_INTRODUCED,
  DOMESTIC_MAMMALS,
  // State data
  STATE_TAX_RATES,
  STATE_INSURANCE_ANNUAL,
  STATE_UTILITIES_MONTHLY,
  STATE_HOMESTEAD,
  STATE_EXTENSION,
  // Google Places filters
  GROCERY_EXCLUDED_TYPES,
  PARK_EXCLUDED_TYPES,
  PARK_LEISURE_TYPES,
  SCHOOL_PLACE_TYPES,
  SCHOOL_NAME_TERMS,
  ELEMENTARY_SCHOOL_EXCLUSIONS,
  COMMERCIAL_DEV_TYPES,
  WALK_TYPES,
  // Airport
  NON_AIRPORT_RE,
  AIRPORT_RE,
  // Broadband
  BROADBAND_TECH_CODES,
  // Interstates
  INTERSTATE_LIST,
  // UI
  CUSTOM_DEST_ICONS,
  ERROR_ICONS,
  MAX_CONCURRENT_PDFS,
  // OSM
  OVERPASS_ENDPOINTS,
  // Development discovery
  DEV_CACHE_TTL_MS,
  DEV_REQUEST_DELAY_MS,
  DEV_MAX_ARTICLE_AGE,
  DEV_TYPE_MAP,
  DEV_STATUS_MAP,
};
```

---

## escapeHtml / esc Consolidation

### The Problem

Two identical functions exist in two files with different names:
- `escapeHtml(str)` — `app.js:764`
- `esc(str)` — `premium.js:24`

Both do the same thing: escape `&`, `<`, `>`, `"`, `'`. There are approximately **50+ call sites** in `premium.js` using `esc()` and an unknown number in `app.js` using `escapeHtml()`.

### The Resolution

1. `src/utils/text.js` exports one canonical function named **`escapeHtml`**.
2. `app.js` replaces its inline `escapeHtml` definition with `const { escapeHtml } = require('./utils/text')`.
3. `premium.js` replaces its inline `esc` definition with `const { escapeHtml } = require('./utils/text')`.
4. Every call to `esc(` in `premium.js` is renamed to `escapeHtml(`.
5. The local `function esc()` and `function escapeHtml()` definitions are deleted from both source files.

### Why `escapeHtml` and not `esc`

`escapeHtml` is the self-documenting name. `esc` is ambiguous (escape? encode? URL-escape?). All new code uses `escapeHtml`.

### Verification command

After implementation, run:

```
grep -n "\besc(" src/premium.js
```

Must return zero results. If it returns any, find and fix before proceeding.

```
grep -rn "function escapeHtml\|const escapeHtml\|function esc\b\|const esc\b" src/
```

Must return exactly one result: the definition in `src/utils/text.js`.

---

## Circular Import Prevention

### Dependency graph for `src/utils/`

```
constants.js  ←  (nothing)
state.js      ←  (nothing)
geo.js        ←  (nothing)
time.js       ←  (nothing)
text.js       ←  state.js (STATE_ABBRS only)
```

### Rules enforced in Phase 1

1. `constants.js` imports from **nothing**. Not from state.js, not from any other utils/ file, not from any src/ file.
2. `state.js`, `geo.js`, `time.js` import from **nothing**. They are standalone.
3. `text.js` may import from `state.js` only (for `STATE_ABBRS` in `toTitleCase`). It does not import from `constants.js` — if it needs a threshold, the caller passes it as a parameter.
4. No utils/ file imports from `app.js`, `premium.js`, `cache.js`, `errorMemory.js`, `logger.js`, or `rateLimit.js`.
5. `app.js` and `premium.js` import from utils/ — never the other direction.

### Why this matters

If `constants.js` imported from `app.js` for anything, every module that imports from `constants.js` would also pull in `app.js`. That defeats the entire purpose of extraction. The zero-dependency rule for `constants.js` is absolute.

---

## The getMitigation Override System

### The Problem

`findNearestGrocery` in `app.js` calls:

```js
const radiusM = getMitigation('findNearestGrocery', 'searchRadiusM', 8000);
```

`getMitigation` is from `src/errorMemory.js`. It allows runtime overrides of search parameters without code changes — used to fix BUG-002 and similar search radius issues in production.

The third argument (`8000`) is the fallback default — what the function uses when no override is set.

### Phase 1 Resolution

The constant `GROCERY_SEARCH_RADIUS_M = 8000` moves to `constants.js` as the canonical default value.

The `getMitigation` call in `findNearestGrocery` is updated to:

```js
const { GROCERY_SEARCH_RADIUS_M } = require('./utils/constants');
// ...
const radiusM = getMitigation('findNearestGrocery', 'searchRadiusM', GROCERY_SEARCH_RADIUS_M);
```

**What does NOT change:**
- The `getMitigation` call itself stays in place
- `src/errorMemory.js` is not touched
- The override behavior is fully preserved
- The only change is that `8000` is no longer a magic number — it references a named constant

### Why this is safe

`constants.js` defines the default. `getMitigation` can still override it at runtime. The two systems are independent — constants.js never imports from errorMemory.js and errorMemory.js never imports from constants.js.

If a future engineer updates `GROCERY_SEARCH_RADIUS_M` to `10000`, the override system still works as before.

---

## Import Pattern for Callers

### app.js header (after extraction)

```js
const { getNextTuesday8am, getNextDayAt } = require('./utils/time');
const {
  escapeHtml, formatDriveTime, toTitleCase,
  parseAddressParts, formatResearchDate, slugify, getDateSlug
} = require('./utils/text');
const {
  INTERSTATE_LIST,
  GROCERY_SEARCH_RADIUS_M,
  GROCERY_CANDIDATE_COUNT,
  GROCERY_EXCLUDED_TYPES,
  HOSPITAL_SEARCH_RADIUS_M,
  HOSPITAL_CANDIDATE_COUNT,
  HIGHWAY_MAX_DRIVE_MINUTES,
  HIGHWAY_INTERCHANGE_MAX_MINUTES,
  ELEMENTARY_SCHOOL_SEARCH_RADIUS_M,
  ELEMENTARY_SCHOOL_EXCLUSIONS,
  COFFEE_SHOP_CANDIDATE_COUNT,
  PARK_EXCLUDED_TYPES,
  PARK_LEISURE_TYPES,
  SCHOOL_PLACE_TYPES,
  SCHOOL_NAME_TERMS,
  TRAFFIC_VARIATION_SLOTS,
  CUSTOM_DEST_ICONS,
  ERROR_ICONS,
  MAX_CONCURRENT_PDFS,
} = require('./utils/constants');
```

### premium.js header (after extraction)

```js
const { haversineDistance } = require('./utils/geo');
const { escapeHtml, formatMoney } = require('./utils/text');
const {
  STATE_TAX_RATES,
  STATE_INSURANCE_ANNUAL,
  STATE_UTILITIES_MONTHLY,
  STATE_HOMESTEAD,
  STATE_EXTENSION,
  TORNADO_TIER,
  RADON_ZONE_BY_STATE,
  FROST_DATE_TABLE,
  NATIVE_PLANT_EXCLUDE,
  NATIVE_PLANT_EXCLUDE_NAMES,
  BENIGN_INTRODUCED,
  DOMESTIC_MAMMALS,
  OVERPASS_ENDPOINTS,
  NON_AIRPORT_RE,
  AIRPORT_RE,
  AIRPORT_SEARCH_RADIUS_M,
  AIRPORT_MAX_DISTANCE_MILES,
  WALKABILITY_SEARCH_RADIUS_M,
  WALK_TYPES,
  DEVELOPMENT_ACTIVITY_SEARCH_RADIUS_M,
  COMMERCIAL_DEV_TYPES,
  RESPONSE_SPEED_MPH,
  RESPONSE_DISPATCH_MINUTES,
  RESPONSE_TIME_THRESHOLDS,
  AQI_THRESHOLDS,
  DNL_THRESHOLDS,
  HIGHWAY_NOISE_ESTIMATE,
  BORTLE_SCALE,
  FEMA_FLOOD_ZONES,
  BROADBAND_TECH_CODES,
  OSM_ROAD_NOISE_RADIUS_M,
  OSM_RAIL_RADIUS_M,
  OSM_LANDUSE_RADIUS_M,
  WATER_QUALITY_SEARCH_RADIUS_MILES,
  INAT_NATIVE_PLANTS_RADIUS_KM,
  INAT_INVASIVE_PLANTS_RADIUS_KM,
  INAT_WILDLIFE_RADIUS_KM,
  INAT_BIRDS_RADIUS_KM,
  INAT_NATIVE_PLANTS_PER_PAGE,
  INAT_INVASIVE_PLANTS_PER_PAGE,
  INAT_WILDLIFE_PER_PAGE,
  INAT_BIRDS_PER_PAGE,
  GROCERY_SEARCH_RADIUS_M,
} = require('./utils/constants');
```

### development-discovery.js header (after extraction)

```js
const {
  DEV_CACHE_TTL_MS,
  DEV_REQUEST_DELAY_MS,
  DEV_MAX_ARTICLE_AGE,
  DEV_TYPE_MAP,
  DEV_STATUS_MAP,
} = require('./utils/constants');
```

---

## What Phase 1 Does NOT Change

Be explicit about the boundaries.

| Item | Status |
|------|--------|
| `src/cache.js` | Not touched — already separated |
| `src/errorMemory.js` | Not touched — already separated |
| `src/logger.js` | Not touched — already separated |
| `src/rateLimit.js` | Not touched — already separated |
| `src/development-intel.js` | Not touched — manual data, not a constant |
| All API call logic in `app.js` | Not touched — Phase 3 |
| All business logic in `app.js` / `premium.js` | Not touched — Phase 2 |
| All HTML generation in `app.js` / `premium.js` | Not touched — Phase 5 |
| `getMitigation` call structure | Not touched — only the magic number argument becomes a constant |
| Express routes | Not touched — Phase 7 |
| Any behavior observable from the outside | Not changed at all |

---

## Acceptance Criteria

Phase 1 is done when **all of the following are true**:

### Structural
- [ ] `src/utils/time.js` exists and exports `getNextTuesday8am`, `getNextDayAt`
- [ ] `src/utils/text.js` exists and exports all 8 functions listed in this spec
- [ ] `src/utils/geo.js` exists and exports `haversineDistance`
- [ ] `src/utils/state.js` exists and exports `STATE_ABBRS`
- [ ] `src/utils/constants.js` exists and exports all constants listed in this spec

### Migration
- [ ] `app.js` imports all functions/constants it previously defined inline — no inline definitions remain for the listed items
- [ ] `premium.js` imports all functions/constants it previously defined inline — no inline definitions remain for the listed items
- [ ] `development-discovery.js` imports its 5 constants from `constants.js`

### escapeHtml consolidation
- [ ] `grep -n "\besc(" src/premium.js` returns **zero results**
- [ ] `grep -rn "function escapeHtml\|const escapeHtml\|function esc\b\|const esc\b" src/` returns **exactly one result** — the definition in `src/utils/text.js`

### Interstate list
- [ ] `grep -r "const interstates = \[" src/` returns **zero results** — the 59-entry array is only in `constants.js`

### Server behavior
- [ ] `node src/app.js` starts without errors
- [ ] Georgetown report generates with no missing data and no errors in console
- [ ] One rural test address (e.g., Harlan, KY) generates without errors
- [ ] One urban test address (e.g., Louisville, KY) generates without errors

### No regressions
- [ ] All sections of the standard report (app.js) render identically to pre-extraction output
- [ ] All sections of the premium report (premium.js) render identically to pre-extraction output
- [ ] Drive times are unchanged
- [ ] No HTML output differences observable by visual inspection

---

## Out of Scope for Phase 1

The following are deferred to later phases and must not be added during Phase 1 implementation:

- Full state name ↔ abbreviation map in `state.js` (Phase 2+)
- `src/data/google/` API call extraction (Phase 3)
- `src/data/government/` API call extraction (Phase 3)
- `src/logic/` business rules layer (Phase 2)
- Any test files (Phase 6)
- eBird integration (deferred indefinitely)
- Moving `development-intel.js` DATABASE to `config/` (separate ticket)
