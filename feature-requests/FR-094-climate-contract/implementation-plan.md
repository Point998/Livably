# FR-094 — Implementation Plan

Tests alongside (CONSTRAINT-011). Pure mapping — no API calls, no new deps. `climateHistory` is already
fully processed; the only logic addition is moving `getTornadoTier` into `logic.js`. `template.js` untouched.
Layer order: logic (+test) → contract (+tests) → wiring → 5-address snapshots.

## Task 1 — `src/modules/climate/logic.js` (add export)
1. Add pure `getTornadoTier(state)` (copy the body from `template.js:540` — `TORNADO_TIER` lookup →
   `{tier:'High'|'Moderate'|'Low'|'Unknown', color, note}`). `require` `TORNADO_TIER` at top (not inline).
2. `// shortcut:` per spec (template keeps its duplicate copy; collapse when template is next touched).
3. Add `getTornadoTier` to `module.exports`.

**Test:** extend/`tests/modules/climate/logic.test.js` (new if absent): High (KY/IN), Moderate (MT), Low (CA),
Unknown (''/'ZZ'). Pure, returns `{tier,color,note}`.

## Task 2 — `src/modules/climate/contract.js` (new)
1. `require('../../contract/schema')` → `safeBuild`; `require('./logic')` → `getTornadoTier`;
   `require('../../utils/constants')` → `CLIMATE_FEMA_LOOKBACK_YEARS`.
2. Band→tone/bucket maps for seismic:
   `SEISMIC_CAUTION = new Set(['moderate','high','very-high'])` (== `promote`); tone caution if in set else favorable;
   bucket check if in set else cool.
3. `buildClimateContract(climateHistory, opts = {})`:
   - `if (!climateHistory) return null;`
   - `asOf = opts.asOf || YYYY-MM`; `state = opts.state || null`; `county = opts.county || 'this county'`.
   - `findings = []`; `push(f, copy?)` sets defaultCopy.
   - **seismic-hazard** when `seismic?.pga` finite: measure `{value:pga, unit:'g_pga'}`; tone/bucket from band set;
     provenance `{source:'USGS ASCE 7-16', asOf, modeled:false}`; defaultCopy `seismic.narrative`. **Read only
     pga + band + narrative — never copy band/label/color/promote/ss/s1/sds into the finding.**
   - **hot-days** when `Number.isFinite(climateNormals?.annual?.daysAbove90)`: cool/neutral; measure
     `{value, unit:'days_per_year'}`; provenance `normalsProv(climateNormals.normalsSource, asOf)`.
   - **cold-days** when `Number.isFinite(climateNormals?.annual?.daysBelow32)`: cool/neutral; measure
     `{value, unit:'days_per_year'}`; same provenance helper.
   - **disaster-history** always: `count = femaDeclarations?.count || 0`; measure
     `{value:count, unit:'federal_disaster_declarations'}`; count 0 → cool/favorable + "No federally declared
     weather disasters in {N} years." ; >0 → consider/neutral + "{county} — {count} federal weather-related
     disaster declaration(s) in the last {N} years." (+ last event from `glance.lastSignificantEvent` when set).
     provenance `{source:'FEMA', asOf, modeled:false}`. `N = CLIMATE_FEMA_LOOKBACK_YEARS`.
   - **tornado-frequency**: `t = state ? getTornadoTier(state) : null`; skip when `!t || t.tier==='Unknown'`.
     tone High→caution/Moderate→neutral/Low→favorable; bucket High→check/Moderate→consider/Low→cool;
     measure null; defaultCopy `t.note`; provenance `{source:'NOAA Storm Events (state averages)', asOf, modeled:true}`.
   - **topographic-position** when `watershed?.topographicPosition`: lowpoint→check/caution + fallbackAction
     instruction (ask seller re water intrusion); uphill→cool/favorable + copy; midslope→**skip**. measure null;
     provenance `{source:'USGS elevation', asOf, modeled:false}`.
   - **named-watershed** when `watershed?.named?.huc12Name`: cool/neutral; measure null; defaultCopy
     "This home sits in the {huc12Name} watershed[, {basinName} basin]."; provenance `{source:'USGS Watershed Boundary Dataset', asOf, modeled:false}`.
   - **emergency-alerts** when `preparedness?.emergencySystem`: check/neutral; measure null;
     tier-1 (`es.tier===1`) → fallback `{type:'url', label:'Register for emergency alerts', value:es.url}` + defaultCopy `es.name`;
     else → fallback `{type:'url', label:'Find your county emergency alert registration', value:es.searchUrl}` + defaultCopy `es.note`;
     provenance `{source:'Local emergency management', asOf, modeled:false}`.
   - provenanceSummary dedupe by `source|asOf`.
   - `safeBuild('climate', () => ({ schemaVersion:'1.0', chapterId:'climate', findings, degraded:!!opts.degraded, provenanceSummary }))`.
4. Helper `normalsProv(src, asOf)`: `src==='NOAA'` → `{source:'NOAA 30-yr normals', asOf, modeled:false}`; else
   `{source:'Open-Meteo ERA5 modeled normals', asOf, modeled:true}`.
5. `module.exports = { buildClimateContract }`.

**Tests:** `tests/modules/climate/contract.test.js` (new) — AC-2..AC-10. Fixtures: full KY-ish (high tornado,
low seismic, NOAA normals, fema count>0, lowpoint, named watershed, tier-1 alerts), a high-seismic fixture
(pga 0.35 → check/caution), an Open-Meteo normals fixture (→ modeled:true), count-0 fixture (→ cool/favorable),
uphill + midslope (midslope omitted), tier-2 alerts (searchUrl), Low tornado (CA), `null`→null. Assertions:
schema-valid + chapterId/version; seismic measure+tone, no band/label/color leak; hot/cold-days +
provenance modeled flag; disaster 0 vs >0; tornado bands + Unknown/no-state omitted; topographic
lowpoint/uphill/midslope; alerts tier-1 vs tier-2 url; **no score/grade/rating (word-boundary) and no
color/band/promote/label leak**.

## Task 3 — `tests/modules/climate/contract.test.js` per-address snapshots
Georgetown/Harlan/Louisville KY + **Jeffersonville IN** (high tornado), **Bozeman MT** (moderate tornado),
synthetic **CA low-tornado + high-seismic** fixture. Deterministic `asOf`.

## Task 4 — wire into `services/reportBuilder.js`
1. Import `buildClimateContract`.
2. In `contract.chapters` add:
   ```
   climate: chapters?.climateHistory
     ? buildClimateContract(chapters.climateHistory, { degraded: degradation.total > 0, state: chapters.locationInfo?.state, county: chapters.locationInfo?.county })
     : null,
   ```

## Task 5 — verify
- `npx jest tests/modules/climate` then full `npx jest`. Green incl. 5 addresses.
- `git diff --stat` shows only logic/contract/reportBuilder/tests — **`climate/template.js` byte-unchanged**.
- Spot-check serialized snapshots: no flood/AQI/radon leakage (env-owned); no band/label/color keys.

## Risks / unknowns
- **`tests/modules/climate/` may already have logic/template tests** — add to the existing dir; don't clobber. Confirm `getTornadoTier` move doesn't break an existing template test (template keeps its copy → it won't).
- **No live test address is low-tornado or high-seismic** — those branches are unit-fixture-only (AC-11). Acceptable: pure mapping, unit-tested.
- **`emergencySystem.tier` is a number (1/2)** — compare `=== 1`, not truthy.
- **Don't leak env-owned data** — the contract reads only `climateHistory`; flood lives in `environment` (FR-090). A test asserts no `floodRisk`/`aqi`/`radon` keys.
