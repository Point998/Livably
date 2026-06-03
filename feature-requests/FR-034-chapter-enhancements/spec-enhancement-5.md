# FR-034 Enhancement 5 — Air Traffic Direction

## What

Add directional context to the airport narrative in the Sensory & Environmental chapter. Currently buyers learn an airport is "6.2 miles away" but not *which direction* — which is the single most useful piece of information for understanding whether their specific home is under a flight path vs. beside one.

## What's Already There

- `getAirportData(lat, lng)` in `sensory/data.js` returns `[{ name, distanceMiles }]`
- Airport lat/lng is computed during the fetch (`p.geometry.location.lat/lng`) but discarded after `haversineDistance`
- `haversineDistance(lat1, lng1, lat2, lng2)` exists in `src/utils/geo.js`
- Template in `buildSensoryEnvironmentalHTML` generates distance-based narrative only

## What's Missing

1. Airport `lat` and `lng` not stored in the returned data shape
2. No `computeBearing()` function anywhere in the codebase
3. No compass-direction label for airports
4. No directional language in template narrative

## What to Build

### Data layer (`sensory/data.js`)

Store airport lat/lng alongside name and distance. New shape:

```js
{ name, distanceMiles, lat, lng }
```

Change one line: in the `.map()` inside `getAirportData`, keep `p.geometry.location.lat` and `p.geometry.location.lng`.

### Logic/utility layer (`src/utils/geo.js`)

Add two pure functions:

**`computeBearing(lat1, lng1, lat2, lng2) → number`**
- Returns bearing in degrees (0–360, clockwise from north)
- Formula: forward azimuth using atan2 on the spherical model

**`bearingToCompass(degrees) → string`**
- Returns one of 8 compass points: N, NE, E, SE, S, SW, W, NW
- Rounds to nearest 45° octant

### Template layer (`sensory/template.js`)

Update `airportPara` in `buildSensoryEnvironmentalHTML`:

**Before:**
```
"Cincinnati/Northern Kentucky International is 22.5 miles away — close enough that…"
```

**After:**
```
"Cincinnati/Northern Kentucky International is 22.5 miles to the southwest. At that distance, aircraft are at altitude…"
```

Add directional language consistently across all distance tiers:
- `< 5 mi`: "X is Y miles to the [direction] — close enough that aircraft on approach or departure are frequently audible, particularly in the mornings and evenings."
- `5–10 mi`: "X is approximately Y miles to the [direction]. Aircraft on approach or departure paths may be audible at this distance during peak periods."
- `10–15 mi`: "The nearest airport, X, is Y miles to the [direction]. Depending on prevailing winds and runway configuration, some approach traffic may occasionally be audible overhead."
- `≥ 15 mi`: "The nearest airport, X, is Y miles to the [direction]. At that distance, aircraft are at altitude and not meaningfully audible at ground level."

Also mention secondary airports with direction: "Blue Grass Airport (8.2 mi to the east) is also in the region."

### What This Does NOT Include

**FAA runway orientation:** Determining whether the home is directly in an approach/departure corridor (vs. beside it) requires knowing runway headings. That requires mapping the Google Place to a FAA ICAO identifier, then calling `api.faa.gov` or a bundled NASR dataset. This is a separate, higher-complexity enhancement — not in scope here.

## Inputs / Outputs

**Input to template:** `env.airports = [{ name, distanceMiles, lat, lng }, ...]`

**Template computes bearing/compass inline** (pure math, no async — no reason to push it into data layer).

## Edge Cases

| Case | Behavior |
|------|----------|
| No airports | No change — existing "no airports" narrative unchanged |
| Airport at exact bearing multiple of 45° | Clamp to one of the 8 cardinal/intercardinal labels |
| Airport lat/lng null (Places API gap) | Skip direction; fall back to distance-only narrative |
| Multiple airports | Direction shown for nearest; secondary airports include direction |
| All airports > 20 miles filtered out | No airports in array; no change |

## Acceptance Criteria

1. `computeBearing(lat1, lng1, lat2, lng2)` returns a number 0–360 to the nearest 0.1°
2. `bearingToCompass(degrees)` returns exactly one of: N, NE, E, SE, S, SW, W, NW
3. All 5 test addresses render a direction label when an airport is within range
4. Direction shown for secondary airports mentioned in the multi-airport case
5. Graceful fallback when `airport.lat` or `airport.lng` is null — no crash, distance-only narrative
6. No inline styles (CONSTRAINT-008)
7. No scoring (CONSTRAINT-001)
8. All existing sensory template tests still pass

## Files to Modify

- `src/utils/geo.js` — add `computeBearing`, `bearingToCompass`
- `src/modules/sensory/data.js` — store `lat`, `lng` on airport objects
- `src/modules/sensory/template.js` — add directional language to `airportPara`
- `tests/utils/geo.test.js` — new test file for bearing functions
- `tests/modules/sensory/template.test.js` — add direction tests; update `baseEnv.airports` fixture to include `lat`, `lng`
