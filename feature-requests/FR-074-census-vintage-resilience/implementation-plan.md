# FR-074 — Census ACS vintage resilience — Implementation Plan

*Phase 3. Single shared file (`src/shared/census.js`) + one constant. Contract-
preserving; consumers untouched. Reuses `sourceChain` + FR-068 ledger.*

## Task 1 — constants (`src/utils/constants.js`)
- Add `CENSUS_ACS_VINTAGES = [2024, 2023, 2022]` (newest-first) + export.

## Task 2 — `src/shared/census.js`
- Imports: `sourceChain` (`./sourceChain`), `logError` (`../logger`),
  `CENSUS_ACS_VINTAGES` (`../utils/constants`).
- `chainLog(fn, origin)` adapter.
- Module state: `const knownAbsentVintages = new Set();` and a small
  `isTransient(err)` (status >= 500 / no status → transient; 404 handled inline).
- **`getCensusFIPS`**:
  - Extract the existing fetch+parse into `fetchFipsOnce(lat, lng)` (returns the
    `{state,county,tract}` or throws on non-ok/parse-miss).
  - Add a one-retry wrapper (transient → 1 s backoff, one retry) inside a
    `sourceChain([{ name:'geocoder', run: () => fetchFipsWithRetry(lat,lng),
    isValid: r => r!=null }], null, {label:'census-fips', log: chainLog(...)}).`
  - Keep `fipsCache` (check first; set positive result). Return null on exhaustion.
- **`fetchCensusACS`**:
  - No key → return null (unchanged).
  - `fetchAcsVintage(vintage, fips, vars)`: build the vintage URL; `404` →
    `knownAbsentVintages.add(vintage)` + throw; other `!ok` → throw; parse; `<2
    rows` → return null; else `{ get, headers, values, vintage }` (get =
    `values[headers.indexOf(name)]`).
  - `const order = CENSUS_ACS_VINTAGES.filter(v => !knownAbsentVintages.has(v));`
  - `const picked = await sourceChain(order.map(v => ({ name:\`acs\${v}\`, run: () =>
    fetchAcsVintage(v, fips, vars), isValid: r => r!=null && typeof r.get ===
    'function' })), null, { label:'census-acs', log: chainLog('fetchCensusACS',
    \`\${fips.state}/\${fips.county}/\${fips.tract}\`) });`
  - Return `picked ? picked.value : null`.
- Exports unchanged (`getCensusFIPS`, `fetchCensusACS`); optionally export
  `CENSUS_ACS_VINTAGES`/`knownAbsentVintages` reset hook for tests (or rely on
  `jest.resetModules()` which `census.test.js` already calls).

## Task 3 — tests (`tests/shared/census.test.js`)
- Keep existing 5 tests green (they `jest.resetModules()` each `beforeEach` →
  module caches reset). Add `, 10000` to the FIPS network-error test (now retries).
- Add `fetchCensusACS` vintage cases (mock `global.fetch` by URL):
  1. Newest (2024) returns rows → `result.vintage === 2024`; one fetch; `.get()`
     works.
  2. 2024 → 404, 2023 → rows → `vintage === 2023`; **second call skips 2024**
     (assert fetch count: call 1 hits 2024+2023, call 2 hits only 2023).
  3. 2024 → 503 (transient), 2023 → rows → `vintage === 2023`; **next call retries
     2024** (not marked absent).
  4. All vintages fail → null + ledger `census-acs` `exhausted` (via
     `runWithLedger`/`getLedger`).
  5. No key → null (already covered; keep).
- Add `getCensusFIPS` cases: transient-then-ok (retry → success); total failure →
  null + `census-fips` ledger event.
- Mock `../../src/logger` (`logError: jest.fn()`) so chainLog stays quiet, matching
  other shared tests. (Check current census.test.js doesn't already need it.)

## Task 4 — verify
- `npx jest` full green.
- **Live verify (where `CENSUS_API_KEY` is set):** run the 5 addresses through
  `getCensusFIPS` + `fetchCensusACS(['B25035_001E'])`; confirm the resolved
  `vintage` (expect newest available) and a real median-year-built value;
  Jeffersonville IN included. If no key locally, document that the fallback list
  makes the change safe and CI/prod carries the key.

## Risks / unknowns
- **No local key** → live ACS verify may only confirm the no-key→null + FIPS paths
  locally; the vintage resolution is exercised by mocked tests + verified in
  CI/prod. Note explicitly in summary.
- **Module-cache leakage across tests** — `jest.resetModules()` in census.test.js
  resets `knownAbsentVintages`; ensure new tests re-`require` after reset (match the
  existing pattern).
- **URL-matching mocks** — vintage tests must branch the fetch mock on the year in
  the URL; keep helpers small.
