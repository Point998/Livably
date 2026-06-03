# FR-034 Enhancement 5 — Implementation Plan: Air Traffic Direction

> **For agentic workers:** Use superpowers:test-driven-development. Write failing tests first, then implement. Commit after each task passes.

## Context

- Working directory: `C:\Users\Borde\livably`
- Test runner: Jest (`npx jest --no-coverage`)
- Design tokens: `public/design-tokens.css`, styles in `public/report.css`
- Baseline: all 1,084 tests pass before starting

---

## Task 1: Add `computeBearing` and `bearingToCompass` to geo.js

**Files to modify:**
- `src/utils/geo.js`
- `tests/utils/geo.test.js` (create if absent)

**Write tests first:**

```js
// tests/utils/geo.test.js
'use strict';
const { haversineDistance, computeBearing, bearingToCompass } = require('../../src/utils/geo');

describe('computeBearing', () => {
  test('due north returns 0', () => {
    // Move straight north: same lng, higher lat
    expect(computeBearing(0, 0, 1, 0)).toBeCloseTo(0, 0);
  });

  test('due east returns 90', () => {
    expect(computeBearing(0, 0, 0, 1)).toBeCloseTo(90, 0);
  });

  test('due south returns 180', () => {
    expect(computeBearing(1, 0, 0, 0)).toBeCloseTo(180, 0);
  });

  test('due west returns 270', () => {
    expect(computeBearing(0, 1, 0, 0)).toBeCloseTo(270, 0);
  });

  test('northeast quadrant', () => {
    const b = computeBearing(38, -84, 39, -83);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(90);
  });

  test('returns value in 0–360 range', () => {
    for (const [la, lo, la2, lo2] of [[0,0,1,1],[1,1,0,0],[0,1,1,0],[1,0,0,1]]) {
      const b = computeBearing(la, lo, la2, lo2);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});

describe('bearingToCompass', () => {
  test('0 → N',   () => expect(bearingToCompass(0)).toBe('N'));
  test('22 → N',  () => expect(bearingToCompass(22)).toBe('N'));
  test('23 → NE', () => expect(bearingToCompass(23)).toBe('NE'));
  test('67 → NE', () => expect(bearingToCompass(67)).toBe('NE'));
  test('68 → E',  () => expect(bearingToCompass(68)).toBe('E'));
  test('90 → E',  () => expect(bearingToCompass(90)).toBe('E'));
  test('112 → E',  () => expect(bearingToCompass(112)).toBe('E'));
  test('113 → SE', () => expect(bearingToCompass(113)).toBe('SE'));
  test('157 → SE', () => expect(bearingToCompass(157)).toBe('SE'));
  test('158 → S',  () => expect(bearingToCompass(158)).toBe('S'));
  test('180 → S',  () => expect(bearingToCompass(180)).toBe('S'));
  test('202 → S',  () => expect(bearingToCompass(202)).toBe('S'));
  test('203 → SW', () => expect(bearingToCompass(203)).toBe('SW'));
  test('247 → SW', () => expect(bearingToCompass(247)).toBe('SW'));
  test('248 → W',  () => expect(bearingToCompass(248)).toBe('W'));
  test('270 → W',  () => expect(bearingToCompass(270)).toBe('W'));
  test('292 → W',  () => expect(bearingToCompass(292)).toBe('W'));
  test('293 → NW', () => expect(bearingToCompass(293)).toBe('NW'));
  test('337 → NW', () => expect(bearingToCompass(337)).toBe('NW'));
  test('338 → N',  () => expect(bearingToCompass(338)).toBe('N'));
  test('359 → N',  () => expect(bearingToCompass(359)).toBe('N'));
});
```

**Implementation — add to `src/utils/geo.js`:**

```js
function computeBearing(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function bearingToCompass(degrees) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((degrees % 360) + 360) % 360 / 45) % 8];
}
```

Update `module.exports` to include both new functions.

**Commit message:** `feat(fr-034): add computeBearing and bearingToCompass to geo.js`

---

## Task 2: Store airport lat/lng in sensory data

**Files to modify:**
- `src/modules/sensory/data.js`

**The change is minimal** — in `getAirportData`, the `.map()` currently discards the airport coordinates. Add them:

**Current:**
```js
.map((p) => ({
  name: p.name,
  distanceMiles: haversineDistance(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
}))
```

**After:**
```js
.map((p) => ({
  name: p.name,
  distanceMiles: haversineDistance(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
  lat: p.geometry.location.lat,
  lng: p.geometry.location.lng,
}))
```

No new tests needed — data layer change is covered by integration tests and the template tests below. The `sensory/data.test.js` should already be checking the returned shape — verify it doesn't reject extra fields.

**Commit message:** `feat(fr-034): store airport lat/lng in sensory data`

---

## Task 3: Add directional language to sensory template

**Files to modify:**
- `src/modules/sensory/template.js`
- `tests/modules/sensory/template.test.js`

**Write tests first** (add to the existing `describe` blocks in `template.test.js`):

Update `baseEnv.airports` fixture to include `lat` and `lng` (the existing tests check names/distances only, so adding fields is safe):

```js
const baseEnv = {
  airports: [{
    name: 'Cincinnati/Northern Kentucky International',
    distanceMiles: 22.5,
    lat: 39.0489,
    lng: -84.6678,
  }],
  // ...rest unchanged
};
```

Add a new describe block:

```js
describe('buildSensoryEnvironmentalHTML — air traffic direction', () => {
  const homeAt = { lat: 38.2109, lng: -84.5592 }; // Georgetown KY approx

  const nearAirport = {
    ...baseEnv,
    airports: [{ name: 'Blue Grass Airport', distanceMiles: 4.2, lat: 38.0365, lng: -84.6059 }],
  };

  const midAirport = {
    ...baseEnv,
    airports: [{ name: 'Blue Grass Airport', distanceMiles: 8.0, lat: 38.0365, lng: -84.6059 }],
  };

  const farAirport = {
    ...baseEnv,
    airports: [{ name: 'Cincinnati/Northern Kentucky International', distanceMiles: 19.1, lat: 39.0489, lng: -84.6678 }],
  };

  test('compass direction appears in airport narrative', () => {
    const html = buildSensoryEnvironmentalHTML(nearAirport);
    expect(html).toMatch(/\b(north|northeast|east|southeast|south|southwest|west|northwest)\b/i);
  });

  test('direction appears for secondary airports in multi-airport narrative', () => {
    const env = {
      ...baseEnv,
      airports: [
        { name: 'Blue Grass Airport', distanceMiles: 4.2, lat: 38.0365, lng: -84.6059 },
        { name: 'Cincinnati/Northern Kentucky International', distanceMiles: 19.1, lat: 39.0489, lng: -84.6678 },
      ],
    };
    const html = buildSensoryEnvironmentalHTML(env);
    // Should mention both airports, each with a direction
    expect(html).toMatch(/Blue Grass Airport/);
    expect(html).toMatch(/Cincinnati\/Northern Kentucky International/);
    expect(html).toMatch(/\b(north|northeast|east|southeast|south|southwest|west|northwest)\b/i);
  });

  test('falls back to distance-only when lat/lng missing', () => {
    const env = {
      ...baseEnv,
      airports: [{ name: 'Test Airport', distanceMiles: 6.0 }],
    };
    const html = buildSensoryEnvironmentalHTML(env);
    expect(html).toMatch(/Test Airport/);
    expect(html).toMatch(/6\.0 miles/);
    // Should not crash
  });

  test('no airports paragraph renders correctly with direction', () => {
    const env = { ...baseEnv, airports: [] };
    const html = buildSensoryEnvironmentalHTML(env);
    expect(html).toMatch(/No airports are within 20 miles/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSensoryEnvironmentalHTML(nearAirport);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

**Implementation — update `buildSensoryEnvironmentalHTML` in `src/modules/sensory/template.js`:**

Add import at top of file:
```js
const { computeBearing, bearingToCompass } = require('../../utils/geo');
```

Replace the `airportPara` block:

```js
let airportPara;
if (!airports || !airports.length) {
  airportPara = 'No airports are within 20 miles of this address. Commercial and general aviation flight traffic is not a daily experience here.';
} else {
  const n = airports[0];
  const d = n.distanceMiles.toFixed(1);
  const hasCoords = n.lat != null && n.lng != null;
  // Template receives home lat/lng via env — not currently available here.
  // See note below on passing homeLat/homeLng.
  const dirStr = hasCoords && env._homeLat != null
    ? ` to the ${bearingToCompass(computeBearing(env._homeLat, env._homeLng, n.lat, n.lng)).toLowerCase()}`
    : '';
  if (n.distanceMiles < 5) {
    airportPara = `${escapeHtml(n.name)} is ${d} miles${dirStr} — close enough that aircraft on approach or departure are frequently audible, particularly in the mornings and evenings. Consider visiting the property during early morning hours (6–9am weekdays) before committing.`;
  } else if (n.distanceMiles < 10) {
    airportPara = `${escapeHtml(n.name)} is approximately ${d} miles${dirStr}. Aircraft on approach or departure paths may be audible at this distance during peak periods. Worth visiting at different times of day to gauge the actual sound level.`;
  } else if (n.distanceMiles < 15) {
    airportPara = `The nearest airport, ${escapeHtml(n.name)}, is ${d} miles${dirStr}. Depending on prevailing winds and runway configuration, some approach traffic may occasionally be audible overhead. At this distance, it's not typically disruptive.`;
  } else {
    airportPara = `The nearest airport, ${escapeHtml(n.name)}, is ${d} miles${dirStr}. At that distance, aircraft are at altitude and not meaningfully audible at ground level. Flight noise is not a daily factor here.`;
  }
  if (airports.length > 1) {
    const others = airports.slice(1, 3).map((a) => {
      const aHasCoords = a.lat != null && a.lng != null;
      const aDir = aHasCoords && env._homeLat != null
        ? ` (${a.distanceMiles.toFixed(1)} mi to the ${bearingToCompass(computeBearing(env._homeLat, env._homeLng, a.lat, a.lng)).toLowerCase()})`
        : ` (${a.distanceMiles.toFixed(1)} mi)`;
      return `${escapeHtml(a.name)}${aDir}`;
    }).join(' and ');
    airportPara += ` ${others} ${airports.length === 2 ? 'is' : 'are'} also in the region.`;
  }
}
```

**IMPORTANT — `_homeLat` / `_homeLng` threading:**

The template currently receives `env` which is the full environmental data object returned by `getEnvironmentalData`. Home lat/lng is not in that object. Two options:

**Option A (preferred — minimal change):** Add `_homeLat` and `_homeLng` to the env object in `getEnvironmentalData` before returning:
```js
return {
  _homeLat: lat,
  _homeLng: lng,
  airQuality: v(airResult),
  // ...rest
};
```
The leading `_` marks it as infrastructure, not API data. Template reads `env._homeLat`.

**Option B:** Thread lat/lng as separate params through `buildSensoryEnvironmentalHTML(env, homeLat, homeLng)`. This is cleaner architecturally but touches the caller chain (reportPage.js → chapterCard → template function). More files to change.

**Use Option A.** The env object is an internal data structure, not an API contract. Adding two coordinate fields with a leading `_` is the smallest diff.

**Update tests** — the `baseEnv` fixture needs `_homeLat` and `_homeLng` to test direction rendering:
```js
const baseEnv = {
  _homeLat: 38.2109,
  _homeLng: -84.5592,
  airports: [{
    name: 'Cincinnati/Northern Kentucky International',
    distanceMiles: 22.5,
    lat: 39.0489,
    lng: -84.6678,
  }],
  // ...
};
```

**Commit message:** `feat(fr-034): add air traffic direction to sensory chapter airport narrative`

---

## Task 4: Verify all 5 test addresses

Run the app on all 5 addresses and confirm:
1. Georgetown KY — airport is to the south (Blue Grass or CVG)
2. Harlan KY — likely no airports within 20 miles (rural mode)
3. Louisville KY — SDF is nearby; confirm direction makes sense
4. Bozeman MT — BZN airport very close; confirm direction
5. Jeffersonville IN — SDF across the river; direction should reflect that

```
npx jest --no-coverage
```
All tests must pass.

---

## Final Steps

1. Run full test suite: `npx jest --no-coverage`
2. Visually verify using `/run` skill on Georgetown KY and Bozeman MT (airport-present cases)
3. Write `summary-enhancement-5.md`
4. Commit summary
5. Push to GitHub
