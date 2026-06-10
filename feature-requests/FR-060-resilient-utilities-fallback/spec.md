# FR-060 — Resilient Utilities fallback (NREL → HIFLD / OpenChargeMap)

## Problem
The Utilities chapter (FR-032) depends on NREL for the electric provider+rate and EV charging. NREL is unverifiable/unreachable from every path we have, and on failure the chapter shows *no data* (link fallback only). This adds a **data fallback** so an NREL failure degrades to real provider/charging data from **reachable** sources (HIFLD, OpenChargeMap), and closes FR-032's provider-verification gap as a bonus.

## Solution
Behind the existing `utilities/data.js` fetchers, add a fallback chain: **NREL primary → reachable source → link fallback**. NREL keeps its unique per-address rate when it's up; HIFLD/OpenChargeMap fill in real provider/charger data when it's down. Each result carries a `source` for provenance. The logic/template change only to render the new "provider known, rate unknown" state and a subtle source note.

## Data Layer — `src/modules/utilities/data.js`

### Electric: NREL → HIFLD
- Refactor the current NREL body into `getElectricFromNREL(lat, lng)` → `{ utilityName, residentialRate, ownership, source: 'NREL' } | null` (unchanged behavior + `source` tag).
- New `getElectricFromHIFLD(lat, lng)` — ArcGIS point query (`HIFLD_TERRITORIES_URL/query?geometry=<lng>,<lat>&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NAME,TYPE&returnGeometry=false&resultRecordCount=1&f=json`, 10s timeout). Returns `{ utilityName: titleCase(NAME), residentialRate: null, ownership: TYPE, source: 'HIFLD' }` or `null` (non-ok / `data.error` present / no feature / empty NAME). `titleCase` = a small helper turning `"KENTUCKY UTILITIES CO"` → `"Kentucky Utilities Co"`.
- `getElectricData(lat, lng)` becomes the orchestrator: `return (await getElectricFromNREL(lat,lng)) || (await getElectricFromHIFLD(lat,lng));`

### EV: NREL → OpenChargeMap
- Refactor the current NREL body into `getEvFromNREL(lat, lng, driveOrigin, getDriveTime, cell)` → `{ level2, dcFast, source: 'NREL' } | null`.
- New `getEvFromOpenChargeMap(lat, lng, driveOrigin, getDriveTime, cell)` — `process.env.OPENCHARGEMAP_API_KEY` required (return `null` if absent). GET `https://api.openchargemap.io/v3/poi/?output=json&latitude=<lat>&longitude=<lng>&distance=25&distanceunit=Miles&maxresults=20&key=<key>` (12s timeout). Classify each POI by `Connections[]`: **L2** = a connection with `LevelID === 2` (or `Level.ID === 2 && !Level.IsFastChargeCapable`); **DC-fast** = `LevelID === 3` (or `Level.IsFastChargeCapable === true`). Nearest of each by `AddressInfo.Distance`, shaped to `{ name (AddressInfo.Title), address (AddressInfo.AddressLine1), driveTimeMinutes (via injected getDriveTime + cellDriveOpts), distanceMiles }` — the **same shape** the NREL path returns. Returns `{ level2, dcFast, source: 'OpenChargeMap' }` or `null` (no key / non-ok / empty / no L2 and no DC).
- `getEvChargingData(...)` orchestrates: NREL → OpenChargeMap.

### `getUtilitiesData` — unchanged
Structure stays (the fetchers self-fall-back). The cached `{ electric, evCharging }` now carry `source`. The both-null total-miss guard is unchanged.

## Logic Layer — `src/modules/utilities/logic.js`
`assembleUtilities(raw, ruralMode, locationInfo)` additions (reads `STATE_AVG_ELECTRIC_RATE`):
- `electricSource: raw.electric?.source ?? null`
- `evSource: raw.evCharging?.source ?? null`
- `stateAvgRate: STATE_AVG_ELECTRIC_RATE[state] ?? null` (for the no-per-address-rate state).
- `getUtilityType(electric.utilityName, electric.ownership)` already maps HIFLD's `"INVESTOR OWNED"` / `"COOPERATIVE"` / `"MUNICIPAL"` strings — **no change needed**. `rateContext` stays `null` when `residentialRate` is null (drives the new template state).

## Template Layer — `src/modules/utilities/template.js`
`buildElectricSection(u)` — three states (was two):
1. **`u.electric && u.rateContext`** (NREL): unchanged — provider + type + per-address rate-vs-state narrative.
2. **`u.electric && !u.rateContext`** (HIFLD fallback — provider known, rate unknown): **NEW** — provider name + type badge + a state-average context line (`Typical residential rate in <state> is about <round(stateAvgRate*100)>¢/kWh; a provider-specific rate wasn't available for this address.`). No guessed per-address number.
3. **`!u.electric`**: unchanged — actionable OpenEI/PUC link fallback.
- **Provenance note:** when `u.electricSource && u.electricSource !== 'NREL'`, append a subtle `<p class="prem-disclaimer">Provider via HIFLD Electric Retail Service Territories.</p>`. Likewise the EV section adds `Charger data via OpenChargeMap.` when `u.evSource === 'OpenChargeMap'`.
- All existing classes; **no inline styles** (CONSTRAINT-008); **no scoring** (CONSTRAINT-001).

## Constants — `src/utils/constants.js`
- `HIFLD_TERRITORIES_URL = 'https://services3.arcgis.com/OYP7N6mAJJCyH6hd/arcgis/rest/services/Electric_Retail_Service_Territories_HIFLD/FeatureServer/0'`

## Config — `.env.example`
- `OPENCHARGEMAP_API_KEY` — free key from openchargemap.org; EV fallback is best-effort and degrades to the AFDC link when unset.

## Fixtures (parser hardening, the NREL/CONSTRAINT-016 lesson)
- `tests/modules/utilities/fixtures/hifld-territories.json` (ArcGIS `features[0].attributes.NAME/TYPE`; plus an empty `features: []` case and a `{ error: {...} }` case).
- `tests/modules/utilities/fixtures/openchargemap-poi.json` (POI list with `Connections[].LevelID` for L2 + DC-fast + a null-distance case).

## Constraints
- CONSTRAINT-001/008/009: no score; no inline styles; data fetches / logic categorizes / template renders.
- CONSTRAINT-011: parser fixtures + tests for fallback ordering; all 5 addresses.
- CONSTRAINT-015: NREL → HIFLD/OCM → link, never silent.
- Cost (FR-058): fallbacks ride the existing cell cache; queried from the centroid; provenance flows through.

## Acceptance Criteria
- [ ] `getElectricFromHIFLD` returns `{utilityName,residentialRate:null,ownership,source:'HIFLD'}` for a valid point; `null` on error/empty; title-cases the name.
- [ ] `getElectricData` returns the NREL result (source 'NREL') when NREL succeeds; falls back to HIFLD (source 'HIFLD') when NREL returns null — and makes no HIFLD call when NREL succeeds.
- [ ] `getEvFromOpenChargeMap` returns `null` without a key; parses L2 + DC-fast from `Connections[]` when keyed; `getEvChargingData` falls back to it when NREL returns null.
- [ ] Live (HIFLD reachable): all 5 test addresses resolve a provider — Georgetown/Harlan → Kentucky Utilities, Louisville → LG&E, **Bozeman → NorthWestern Energy**, Jeffersonville → Duke Energy Indiana (closes FR-032's verification gap).
- [ ] Template renders the "provider known, rate unknown" state (provider + type + state-avg context) on the HIFLD path, with a "via HIFLD" note; EV shows a "via OpenChargeMap" note on that path.
- [ ] No scoring, no inline styles; fixtures committed; full suite green.
