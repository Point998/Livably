# FR-073 — USGS elevation resilience — Implementation Plan

*Phase 3. Ordered constants → shared helper → climate → garden → test migration →
verify. Reuses `sourceChain`; new `src/shared/elevation.js`.*

## Task 1 — constants (`src/utils/constants.js`)
- Add `OPENTOPODATA_NED10M_URL = 'https://api.opentopodata.org/v1/ned10m'` + export.
- `USGS_ELEVATION_URL` already exists/exported.

## Task 2 — shared helper (`src/shared/elevation.js`) [new]
- Imports: `sourceChain`, `logError`, `USGS_ELEVATION_URL`, `OPENTOPODATA_NED10M_URL`.
- `chainLog(fn, origin)` adapter.
- `const FEET_PER_METER = 3.28084;`
- `cleanFeet(v)` — `v == null || v <= -1000 ? null : Math.round(v)` (unified no-data
  guard).
- `epqsPointFeet(lat, lng)` — relocated `fetchElevationWithRetry` body (2 retries,
  5 s timeout, 1 s backoff, `units=Feet`); returns `cleanFeet(value)` or null
  (never throws — returns null after retries, so a partial EPQS outage still yields
  per-point nulls without killing the batch).
- `epqsElevations(points)` — `Promise.all(points.map(([la,ln]) => epqsPointFeet))`
  → `feet[]`.
- `openTopoElevations(points)` — one GET `?locations=la,ln|…` (8 s timeout); on
  `!ok` throw; map `results[i].elevation` (meters) → `cleanFeet(m*FEET_PER_METER)`.
  Length/order matches `points`.
- `centerPresent = (arr) => Array.isArray(arr) && arr[0] != null`.
- `fetchElevationsFeet(points)` — `sourceChain([{name:'epqs',run,isValid:centerPresent},
  {name:'opentopo',run,isValid:centerPresent}], null, {label:'elevation',
  log: chainLog('fetchElevationsFeet', originOf(points))})`; return `picked ?
  picked.value : null`.
- `fetchElevationFeet(lat,lng)` — `(await fetchElevationsFeet([[lat,lng]]))?.[0] ?? null`.
- Export both public fns (+ `epqsPointFeet` for tests).

## Task 3 — climate (`src/modules/climate/data.js`)
- Import `fetchElevationsFeet` from `../../shared/elevation`.
- `getWatershedContext`: keep offsets; replace the `urls`/`fetchElevationWithRetry`/
  `logError`-loop block with `const elevations0 = await fetchElevationsFeet(points)`;
  `if (!elevations0 || elevations0[0] == null) return null;`
  `const center = elevations0[0]; const elevations = elevations0.map((v,i)=> i===0 ?
  center : (v ?? center));`
  `return { elevations, position: classifyTopographicPosition(elevations) };`
- Remove the local `fetchElevationWithRetry` definition + its export (migrated).
  Check no other in-file caller. Keep `logError` import only if still used elsewhere
  in the file (it is — watershed/other); else leave.

## Task 4 — garden (`src/modules/garden/data.js`)
- Import `fetchElevationFeet` from `../../shared/elevation`.
- `getMicroclimateData`: replace the `try/catch` elevation block with
  `const elevationFt = await fetchElevationFeet(lat, lng);`. Remove now-unused
  `USGS_ELEVATION_URL` import if nothing else uses it.

## Task 5 — tests
- New `tests/shared/elevation.test.js` — mock `global.fetch`:
  - `epqsPointFeet`/`fetchElevationFeet`: success, retry-then-success, exhaust→null,
    null-value→null, −9999→null, `units=Feet` in URL.
  - m→ft: OpenTopoData 258.6 m → 848.
  - batch: `fetchElevationsFeet` returns array aligned to points.
  - fallback: EPQS center fails (all EPQS calls !ok) + OpenTopoData ok → feet via
    OpenTopoData; assert ledger `fallback` via `runWithLedger`/`getLedger`.
  - both down → null + ledger `error`+`exhausted`.
- `tests/modules/climate/data.test.js` — **move** the 6 `fetchElevationWithRetry`
  tests out (now in shared). Update `getWatershedContext` tests: they mock
  `global.fetch`; keep the success + center-fail→null cases; **drop** the
  `logError('getWatershedContext',…)` exhaustion asserts (replace with null-return
  assert, and optionally a ledger assert). Ensure OpenTopoData is also mocked to
  fail in the “EPQS fails → null” cases (so the fallback doesn’t rescue them).
- `tests/modules/garden/data.test.js` — `getMicroclimateData` cases keep passing
  (fetch-mocked). Add: EPQS fail + OpenTopoData success → `elevationFt` from
  fallback. Ensure both-fail cases mock OpenTopoData to fail too.
- `tests/chapters/climate-data.test.js` — the EPQS-fail→null path: mock OpenTopoData
  to fail as well so the assertion holds.

## Task 6 — verify
- `npx jest` full green.
- Live check across 5 addresses: `fetchElevationsFeet` (EPQS path) returns sane
  feet; force-fallback smoke (point EPQS at a bad URL or simulate) optional;
  confirm OpenTopoData batch returns aligned feet for one address. Jeffersonville IN
  included. Space calls (OpenTopoData ~1/s).

## Risks / unknowns
- **Mock alignment**: several existing tests mock `global.fetch` generically; after
  the refactor a single fetch mock now feeds EPQS *and* (on fail) OpenTopoData.
  Tests asserting "EPQS down → null" must make the catch-all fetch mock fail for
  both hosts (it will, if it rejects/!ok unconditionally) — verify each.
- **`fetchElevationWithRetry` export removal**: grep for external importers before
  deleting; only `climate/data.js` + its test reference it.
- **Latency**: OpenTopoData only called when EPQS center fails; bounded 8 s.
