# FR-073 — USGS elevation resilience (non-Google single) — Specification

*Phase 2. New `src/shared/elevation.js` + two consumers (`climate`, `garden`).
Shape (chosen): **EPQS primary → OpenTopoData `ned10m` fallback → honest absence**,
in one shared, `sourceChain`-observable, batch-aware helper. Floor = absence (both
templates already degrade by omission; no link needed — unlike FR-072 soil).*

## Goal

De-duplicate the two independent USGS EPQS fetches onto one resilient helper that
(1) falls back to a verified independent DEM (OpenTopoData NED 10 m) when EPQS is
down, and (2) records the degradation in the FR-068 ledger — fixing both the
single-point-of-failure and the observability gap (climate logged to `logError`
only; garden was fully silent), with **no change to climate's topographic-position
logic or garden's microclimate output shape**.

## New module — `src/shared/elevation.js`

```
fetchElevationsFeet(points) -> number[] | null          // points: [[lat,lng], …]
fetchElevationFeet(lat, lng) -> number | null
```

- **`fetchElevationsFeet(points)`** = `sourceChain([
    { name: 'epqs',     run: () => epqsElevations(points),       isValid: centerPresent },
    { name: 'opentopo', run: () => openTopoElevations(points),   isValid: centerPresent },
  ], null, { label: 'elevation', log: chainLog('fetchElevationsFeet', originOf(points)) })`
  → returns `picked ? picked.value : null`.
  - `centerPresent = (arr) => Array.isArray(arr) && arr[0] != null` — the center
    point (index 0) is the one that matters; surrounding nulls are acceptable
    (climate fills them). A null center = miss → fall through / exhaust.
- **`epqsElevations(points)`** — query each point via `epqsPointFeet(lat,lng)`
  (the relocated `fetchElevationWithRetry`: 2 retries, 5 s timeout, 1 s backoff;
  `units=Feet`). Returns `feet[]` (null per failed point). **No-data guard
  (unified):** value `null` **or** `<= -1000` → `null` (preserves garden's −9999
  sentinel test; hardens climate against a −9999 corrupting topo classification).
  Rounds to integer feet.
- **`openTopoElevations(points)`** — one batched GET to
  `https://api.opentopodata.org/v1/ned10m?locations=lat,lng|…` (≤100/call; we send
  ≤5), 8 s timeout. Parse `results[i].elevation` (**meters → feet** ×3.28084,
  rounded), null/`<= -1000`→null. On non-ok/throw → throw (so the chain treats it
  as a miss, not a silent empty).
- **`fetchElevationFeet(lat,lng)`** = `(await fetchElevationsFeet([[lat,lng]]))?.[0]
  ?? null`.
- Constants: reuse `USGS_ELEVATION_URL`; add `OPENTOPODATA_NED10M_URL` to
  `constants.js`. `chainLog` adapter (FR-070+ form). No env keys (both keyless).

## Climate — `src/modules/climate/data.js`

- `getWatershedContext(lat, lng)`: build the same 5 offset points, then
  `const elevations = await fetchElevationsFeet(points);`
  - `if (!elevations || elevations[0] == null) return null;` (unchanged contract).
  - Fill missing surrounding with center + `classifyTopographicPosition` **exactly
    as today** (`results.map((v,i)=> i===0 ? center : (v ?? center))`).
- **Remove** the inline `fetchElevationWithRetry` + the per-point `logError`
  exhaustion loop (observability now lives in the shared helper's `sourceChain`).
- Keep exporting `fetchElevationWithRetry` as a **thin re-export** of the shared
  `epqsPointFeet` *only if* needed for back-compat; otherwise drop it and migrate
  its tests (see Tests). Prefer dropping — cleaner.
- SOURCES `usgs-elevation` descriptor: unchanged target (`getWatershedContext`) —
  it already gates on `elevations.length`; the EPQS-specific monitoring is implicit
  (EPQS is source 0 of the chain). *(Optional: leave as is.)*

## Garden — `src/modules/garden/data.js`

- `getMicroclimateData(lat, lng)`: replace the `try/catch` elevation block with
  `const elevationFt = await fetchElevationFeet(lat, lng);` — returns rounded feet
  or null. Output shape `{ lat, elevationFt, solarSummerDeg, solarWinterDeg }`
  unchanged. Solar angles still always computed.
- SOURCES `usgs-elevation-garden` descriptor: unchanged target.

## Observability

The shared `sourceChain` records — for free, per report — `fallback` when EPQS
misses and OpenTopoData wins, and `error`+`exhausted` when both fail (FR-068
ledger, label `elevation`). Replaces climate's `logError`-only path and garden's
total silence.

## Edge cases

| Case | Expected |
|---|---|
| EPQS up | feet from EPQS; **no OpenTopoData call**; no degradation event |
| EPQS center fails, OpenTopoData up | OpenTopoData feet (m→ft); ledger `fallback`; climate/garden unchanged downstream |
| EPQS surrounding-only fails (center ok) | center present → EPQS wins; climate fills missing with center (as today) |
| Both down | `null` → climate returns null (no topo narrative); garden `elevationFt:null` (no elev note); ledger `error`+`exhausted` |
| EPQS returns −9999 / ≤ −1000 | treated as null (no-data), not a real elevation |
| OpenTopoData meters | converted to feet (×3.28084), rounded |

## Acceptance criteria

1. EPQS up → identical elevations to today (rounded feet); **no OpenTopoData call**;
   no degradation event.
2. EPQS center-fail + OpenTopoData up → valid feet via fallback; ledger records
   `fallback` (assert via `runWithLedger`/`getLedger`).
3. Both down → `null`; climate `getWatershedContext` → null; garden `elevationFt`
   → null (solar angles still present); ledger records `error`+`exhausted`.
4. Climate topographic-position output byte-identical for the same elevations
   (fill-with-center + `classifyTopographicPosition` untouched).
5. Garden `getMicroclimateData` shape unchanged; −9999 sentinel → null preserved.
6. m→ft conversion correct (OpenTopoData 258.6 m → ~848 ft).
7. No env keys added; no scoring; reuses `sourceChain` (CONSTRAINT-014); shared
   helper joins the `shared/` family.
8. Tests: new `tests/shared/elevation.test.js` (EPQS success/retry/exhaust, m→ft,
   batch, fallback-on-center-fail, both-down→null + ledger events); migrated/updated
   climate `getWatershedContext` + garden `getMicroclimateData` suites green;
   **Jeffersonville IN** in the live check; all suites green.

## Test migration (the main churn)
- `tests/modules/climate/data.test.js`: the 6 `fetchElevationWithRetry` tests move
  to `tests/shared/elevation.test.js` (testing `epqsPointFeet`/`fetchElevationsFeet`).
  `getWatershedContext` tests stay but drop the `logError('getWatershedContext',…)`
  exhaustion asserts (observability moved to the ledger) — assert the `null`
  return + (optionally) a ledger event instead.
- `tests/modules/garden/data.test.js`: `getMicroclimateData` tests keep passing —
  they mock `global.fetch`; the helper uses `global.fetch`, so EPQS-success/fail/
  null/−9999 cases still hold. Add a fallback case (EPQS fail → OpenTopoData).
- `tests/chapters/climate-data.test.js`: EPQS-fail→null path still holds (now with
  OpenTopoData also mocked to fail).

## Out of scope / deferred
- Self-hosted OpenTopoData / higher rate limits — Hardening-scale concern.
- Global `srtm30m` dataset for non-CONUS points — US product; not needed.
- Cell-caching elevation (climate's `getWatershedContext` isn't cell-cached today)
  — separate optimization, not this slice.
