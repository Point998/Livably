# FR-074 — Census ACS vintage resilience (final non-Google single) — Specification

*Phase 2. Module: `src/shared/census.js` (+ one constant). Scope (chosen): ACS
vintage fallback **and** a light `getCensusFIPS` hardening. Hardened-primary
lineage (FR-072), with the fallback axis being **ACS vintages of the same source**.
Contract-preserving — the 6 consumers + `census.test.js` keep working unchanged.*

## Goal

1. **Currency + resilience** — serve the **newest available** ACS5 vintage and
   survive a missing/retired one, instead of the stale hard-coded `2022`.
2. **Observability** — record degradation for the app's most-shared external source
   in the FR-068 ledger (was a silent `try/catch → null`).
3. Same for the **upstream FIPS geocoder** (light retry + observability).

No keyless fallback (confirmed not viable — Census requires a key).

## New constant (`src/utils/constants.js`)
```js
// FR-074 — ACS5 vintages tried newest-first. Bump the head as new releases land;
// older entries stay as the resilience floor.
const CENSUS_ACS_VINTAGES = [2024, 2023, 2022];
```
Export `CENSUS_ACS_VINTAGES`.

## `fetchCensusACS(fips, vars)` — vintage fallback + observability

Contract **unchanged**: returns `{ get, headers, values }` (now **+ additive
`vintage`**) or `null`. `get(name) = values[headers.indexOf(name)]`.

- **No key** → `null` (unchanged; `census.test.js` relies on this).
- **Module state:** `knownAbsentVintages` (Set) — vintages proven *permanently*
  absent (HTTP 404) so future calls skip them. (Transient 5xx/timeout does **not**
  mark absent → self-heals next call; avoids sticking the process to a staler
  vintage after a blip — discovery risk #3.)
- **Try order:** `CENSUS_ACS_VINTAGES.filter(v => !knownAbsentVintages.has(v))`,
  newest-first.
- Wrap in `sourceChain(order.map(v => ({ name: \`acs\${v}\`, run: () =>
  fetchAcsVintage(v, fips, vars), isValid: r => r != null && typeof r.get ===
  'function' })), null, { label: 'census-acs', log: chainLog('fetchCensusACS',
  \`\${state}/\${county}/\${tract}\`) })`. Return `picked ? picked.value : null`.
- **`fetchAcsVintage(vintage, fips, vars)`** —
  GET `https://api.census.gov/data/<vintage>/acs/acs5?get=…&for=tract:…&in=state:…
  %20county:…&key=…`:
  - `resp.status === 404` → `knownAbsentVintages.add(vintage)` then **throw**
    (`vintage absent`) → chain tries the next (older) vintage.
  - other `!resp.ok` → **throw** (transient) → chain tries next; *not* marked absent.
  - parse `[headers, values]`; `< 2 rows` → return `null` (chain miss → next).
  - else → `{ get, headers, values, vintage }`.

The vintage chain *is* the multi-attempt resilience (a transient on the newest
vintage degrades to the next-newest — still valid Census data, ledger-visible — no
separate same-vintage retry, to bound latency). The `sourceChain` records
`fallback` (older vintage won) + `exhausted` (all failed) in the FR-068 ledger.

## `getCensusFIPS(lat, lng)` — light hardening

Contract **unchanged**: `{ state, county, tract }` or `null`, `fipsCache` preserved.
- Extract the fetch+parse into `fetchFipsOnce(lat, lng)` with **one transient
  retry** (timeout/network/5xx; 1 s backoff).
- Wrap in `sourceChain([{ name: 'geocoder', run: () => fetchFipsOnce(lat, lng),
  isValid: r => r != null }], null, { label: 'census-fips', log:
  chainLog('getCensusFIPS', \`\${lat},\${lng}\`) })` so a FIPS outage is recorded
  in the ledger (the upstream cascade for everything is no longer silent). Cache the
  resolved value (positive only), as today.

## Shared additions
- `chainLog(fn, origin)` adapter (FR-070+ form); import `sourceChain`, `logError`,
  `CENSUS_ACS_VINTAGES` into `census.js`.

## Provenance (additive, no template churn this slice)
The result carries `vintage` so consumers' "ACS 5-year estimates" disclaimers
*can* name the year later. Surfacing it in the 6 templates is **deferred** (a
separate, low-stakes UI pass) — this slice keeps the diff in the shared layer.

## Edge cases

| Case | Expected |
|---|---|
| Key set, newest vintage has data | returns it (`vintage` = newest); no older calls |
| Newest vintage 404 (not yet released) | marked absent; falls to next; future calls skip it |
| Newest vintage 5xx/timeout | falls to next vintage (valid, 1 yr staler); **not** marked absent → retried next call; ledger `fallback` |
| All vintages fail | `null`; ledger `error`/`exhausted`; consumers degrade as today |
| No `CENSUS_API_KEY` | `null` (unchanged) |
| FIPS transient fail then ok | one retry → success |
| FIPS down | `null` (cascade as today) + ledger `census-fips` event |

## Acceptance criteria

1. Key set + newest vintage returns data → `{ get, headers, values, vintage:newest }`;
   `.get()` identical to today; no older-vintage calls.
2. Newest 404 → next vintage used; `knownAbsentVintages` skips it on the next call
   (assert call count).
3. Newest 5xx → older vintage used **and** newest retried on the subsequent call
   (not marked absent).
4. All vintages fail → `null` + FR-068 ledger has `census-acs` `exhausted` (assert
   via `runWithLedger`/`getLedger`).
5. No key → `null` (unchanged).
6. `getCensusFIPS`: success unchanged + cached; transient-then-ok retries; total
   failure → `null` + `census-fips` ledger event.
7. `{ get, headers, values }` contract intact → all 6 consumers + existing
   `census.test.js` behavior preserved (additive `vintage` only).
8. Tests: new vintage-fallback + ledger cases; existing `census.test.js` green
   (timeouts added where the retry now applies). **Live verify runs where
   `CENSUS_API_KEY` is set** (the discovery shell had none) — confirm the newest
   vintage resolves for the 5 addresses; otherwise the fallback list keeps it safe.

## Out of scope / deferred
- Surfacing the `vintage` year in the 6 chapter disclaimers (additive UI pass).
- `getCensusFIPS` *fallback* source (no independent geocoder mirror; retry +
  observability only).
- Variable-availability checks per vintage (vars used are long-stable ACS5 tables;
  a rejecting vintage simply falls through).
