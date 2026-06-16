# FR-065 — Implementation Plan (Phase 3)

*Ordered by layer, primitive-first. TDD: tests written alongside each unit (CONSTRAINT-011). No code in this phase — this is the plan. Builds on `spec.md`.*

## Confirmed in planning (de-risks the spec's open questions)

- **Modeled source = Open-Meteo Archive API (ERA5 reanalysis)**, `https://archive-api.open-meteo.com/v1/archive`. **Reachable from the dev environment** (HTTP 200; NREL's DNS block does not apply here). Keyless — **no new `.env` entry**.
- **Request:** `?latitude=&longitude=&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto`.
- **Response shape:** `daily.time[]` + parallel `daily.temperature_2m_max[] / temperature_2m_min[] / precipitation_sum[] / snowfall_sum[]`. `daily_units` confirms °F / inch / inch — **already in target units; do NOT apply NOAA's tenths/hundredths division.**
- **Period:** use the official **1991–2020** normals window. (NOAA path currently labels the 2010 vintage — a deliberate, honestly-labeled mismatch; fallback only fires when NOAA is absent.)
- **Grid snapping** is inherent (≈regional reading) — exactly what the honest-provenance callout states.

## Task order

### Task 1 — Shared primitive (`src/shared/sourceChain.js`) + tests
- Implement `sourceChain(sources, ctx, { label, isValid })` per spec: ordered try, first `isValid` wins, returns `{ value, source }` or `null`; logs each miss/error via existing `logger` with the `label`.
- **Tests first** (`tests/shared/sourceChain.test.js`): first-valid-wins + correct `source`; skips invalid; skips throwing source (and logs, doesn't crash); custom `isValid` honored; all-fail → `null`; later sources not called once one succeeds (spy).
- Pure module — no `fetch`/cache/env. CONSTRAINT-014.

### Task 2 — Constants (`src/utils/constants.js`)
- `OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'`
- `CLIMATE_NORMALS_MODEL_PERIOD = { start: '1991-01-01', end: '2020-12-31' }`
- No hard-coded URLs/periods in `data.js` (CONSTRAINT-009 spirit).

### Task 3 — Data layer (`src/modules/climate/data.js`)
1. **Rename** existing NOAA body → `getNormalsFromNOAA(lat, lng)` (behavior unchanged; still `{ monthly, annual, stationId, stationName } | null`).
2. **Add pure transform** `aggregateOpenMeteoNormals(daily)` (separately unit-testable, no IO):
   - Group daily values by calendar month across all years.
   - `tMaxF` = mean of `temperature_2m_max` in month; `tMinF` = mean of `temperature_2m_min`.
   - `precipIn` = mean **monthly total** (sum per year-month, then average across years); same method for `snowIn` from `snowfall_sum`.
   - `annual.daysAbove90` = mean per-year count of days `temperature_2m_max >= 90`; `daysAbove95` ≥ 95; `daysBelow32` = days `temperature_2m_min <= 32`.
   - Returns the **exact NOAA contract**: `{ monthly:[12×{month,tMaxF,tMinF,precipIn,snowIn}], annual:{daysAbove90,daysAbove95,daysBelow32}, stationId:null, stationName:'Modeled climatology (Open-Meteo, 1991–2020)' }`.
3. **Add fetcher** `getNormalsFromModel(lat, lng)`: builds the request from constants, 15s timeout, `null` on non-ok/throw, else `aggregateOpenMeteoNormals(data.daily)`.
4. **Wire the chain** at the existing call site:
   `sourceChain([{name:'NOAA',run:()=>getNormalsFromNOAA(lat,lng),isValid:V},{name:'model',run:()=>getNormalsFromModel(lat,lng),isValid:V}], null, {label:'climate-normals'})` where `V = r => Array.isArray(r?.monthly) && r.monthly.some(m=>m.tMaxF!=null)` (the CONSTRAINT-016 record-content guard, now applied to both tiers). Unwrap → `{ ...value, normalsSource: source } | null`.
5. **SOURCES descriptor**: add `{ id:'openmeteo-normals-fallback', label:'Open-Meteo ERA5 modeled climate normals', provider:'open-meteo', coverage:'all', run:(ctx)=>getNormalsFromModel(ctx.lat,ctx.lng), isValid:V }` so FR-063 verifies it.
- **Tests** (`tests/modules/climate/`): `aggregateOpenMeteoNormals` against a committed fixture (`fixtures/openmeteo-archive.json`, a few months of daily rows) → exact monthly/annual numbers + nullable `snowIn`; `getNormalsFromModel` non-ok → `null`.

### Task 4 — Logic layer (`src/modules/climate/logic.js`)
- Thread `normalsSource: raw.normals?.normalsSource ?? null` onto the assembled climate object. **No rule change** (identical monthly/annual shape).

### Task 5 — Template layer (`src/modules/climate/template.js`)
- When `normalsSource && normalsSource !== 'NOAA'`, render the honest-provenance line from the spec (`prem-disclaimer` class, regional/modeled framing, confident tone). NOAA path untouched. No inline styles (CONSTRAINT-008); no scoring (CONSTRAINT-001).

### Task 6 — Full verification (CONSTRAINT-011)
- `npm test` green (new + all existing climate tests unchanged).
- `npm run verify:sources` for climate — confirm both NOAA and the Open-Meteo fallback PASS across the 5 addresses.
- **Live 5-address check**, especially **Louisville KY (the PM-004 address)** — confirm it now renders a normals band (real or modeled) instead of the blank/link floor; confirm the provenance note appears only on the modeled path.

## Risks & unknowns

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Response volume** — 30 yrs daily ≈ ~1.3 MB/call | Low | Fallback fires **only on NOAA miss** (rare, rural). Optional: cell-cache the model result (see below). No Google cost. |
| **Unit double-conversion** — applying NOAA's `/10`,`/100` to Open-Meteo's already-°F/inch values | Med (silent bad data) | Aggregation is a *separate* function from the NOAA pivot; fixture test asserts real-world-plausible numbers. Explicit in Task 3.2. |
| **Period mismatch** — NOAA 2010 vintage vs model 1991–2020 | Low | Honestly labeled in the provenance note + `stationName`; tiers never blend (chain returns one). |
| **`snowfall_sum` unit** | Low | Probe confirmed `daily_units.snowfall_sum = "inch"` when `precipitation_unit=inch`; assert in fixture test. |
| **Open-Meteo reachability in CI/deploy** differs from dev | Low | It's the *fallback*; if it's also down, the link floor (CONSTRAINT-015) still covers. FR-063 monitor will flag it. |

## Optional (droppable to keep the slice tight)
- **Cell-cache the model normals result** under a new `normalsCache` keyed by cell (FR-058 consistency; meaningful given the ~1.3 MB fetch). Recommended but not required — decide at implementation if it adds churn. Caching the NOAA *primary* path is explicitly **out of scope** (don't touch the working primary).

## Definition of done
All Task-6 checks green; provenance principle visible on a real modeled-path address; no scoring/inline styles; fixtures committed; `summary.md` written; PR opened.
