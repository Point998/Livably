# FR-072 — USDA soil resilience — Implementation Plan

*Phase 3. Ordered data → sources → template → tests. Single module (`property`);
Garden inherits the unchanged `soil` object. No constants needed.*

## Task 1 — data (`src/modules/property/data.js`)
- New imports: `sourceChain` (`../../shared/sourceChain`), `logError`
  (`../../logger`).
- Add `chainLog(fn, origin)` adapter (FR-070/071 form).
- Add a small `isTransient(err)` helper (timeout/`AbortError`/network/5xx → true;
  4xx → false) and a `SOILWEB_GMAP_BASE` const local to the file.
- **Rename** current `getSoilData` body → `getSoilDataSDA(lat, lng)` and change its
  failure semantics:
  - `!resp.ok` → throw `Error('SDA HTTP ' + resp.status)`.
  - empty/absent `Table` → return `null` (legit unmapped point).
  - rows → return the soil object (unchanged fields).
  - Wrap the fetch in a single **retry on transient throw** (2nd attempt at 10 s
    timeout); non-transient or 2nd failure → rethrow.
- Add public `getSoilData(lat, lng)` = `sourceChain([{ name:'sda', run, isValid:
  isValidSoilOrEmpty }], null, { label:'property-soil', log: chainLog(...) })`;
  return `picked ? picked.value : null`.
  `isValidSoilOrEmpty = (r) => r === null || (r && typeof r.drainagecl === 'string')`.
- `getPropertyIntelligence(lat, lng, fips, locationInfo)` — add
  `soilwebUrl = ${SOILWEB_GMAP_BASE}?loc=${lat},${lng}` to the returned object.
- `module.exports`: add `getSoilDataSDA` (keep `getSoilData`).

## Task 2 — SOURCES (`src/modules/property/data.js`)
- Repoint `usda-soil.run` → `getSoilDataSDA`; `isValid: (r) => r === null ||
  typeof r?.drainagecl === 'string'` (legit-empty not false-flagged; throw is the
  failure signal).

## Task 3 — template (`src/modules/property/template.js`)
- `buildSoilTab(soil)` → `buildSoilTab(soil, soilwebUrl)`: in the `!soil` branch,
  append a point-specific SoilWeb link next to the geotech/seller prompt. Update
  its caller (the tabs array in `buildPropertyDeepDiveTabs`/wherever) to pass
  `propIntel.soilwebUrl`.
- Research tab `soilSection`: when `soilwebUrl` is present, point the "Full soil
  data" link at it (point-specific) instead of the WSS homepage; the section needs
  `soilwebUrl` in scope (it's built inside the research-tab builder that receives
  `propIntel`). If `soilwebUrl` is absent (defensive), fall back to the WSS
  homepage string.
- No CSS/class changes.

## Task 4 — tests (`tests/modules/property/`)
- `data.test.js` — mock `global.fetch` + use `runWithLedger`/`getLedger` from the
  real `degradationLedger` (not mocked) to assert observability:
  1. SDA success (mapped) → soil object, fields correct, `fetch` called once.
  2. Empty `Table` → `null`, **no ledger event**, `fetch` called once (no retry).
  3. `!resp.ok` 503 twice → `getSoilData` returns `null` **and** ledger has an
     `error`+`exhausted` for `property-soil`; `fetch` called twice (one retry).
  4. 503 then 200 → soil object, `fetch` called twice.
  5. 4xx (e.g. 400) → no retry (`fetch` once) → `null` + ledger event.
  6. `getPropertyIntelligence` returns `soilwebUrl` containing `gmap/?loc=` + the
     coords.
- `template.test.js` — `buildSoilTab(null, url)` (or via
  `buildPropertyIntelligenceHTML`/research tab) renders the coordinate SoilWeb link
  in the floor; soil-present case unchanged.

## Task 5 — verify (Phase 4 close)
- `npx jest` full green.
- Live SDA check across the 5 addresses (confirm muname/drainage/hydric sane;
  Jeffersonville IN returns IN-side soil). Space calls politely.
- Confirm `/gmap/?loc=lat,lng` returns 200 for one address (floor link is live).

## Risks / unknowns
- **Retry latency** — bounded to one retry @ 10 s; soil runs in the existing
  `Promise.allSettled`, so it doesn't block sibling property data, only the report
  tail. Acceptable; documented.
- **`buildSoilTab` caller threading** — confirm the tab list passes `soilwebUrl`;
  small signature change, guard the param (defaults to WSS homepage if absent).
- **Ledger in tests** — use `runWithLedger(() => …)` to give the assertions an
  active context (the data fn no-ops cleanly without one in production callers).
