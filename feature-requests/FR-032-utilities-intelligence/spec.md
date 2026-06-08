# FR-032 — Utilities & Power

> **Reconciled June 2026.** Supersedes the original May-2026 vision spec (preserved in git history). Scope reduced to what has a clean, free, address-level data source ("solid core first"); broader items from the original vision are recorded under **Deferred** so they aren't lost. Chapter color, placement, tone, and concrete acceptance examples are carried forward from the original.

## Problem
There is no Utilities chapter. Buyers can't see, before signing, who provides their electricity, what they'll likely pay relative to the state, how reliable the grid is, whether the home is on municipal services vs well/septic/propane, or what EV charging costs here. The `utilities/` module slot is reserved but empty. The Property chapter already covers internet (FCC), so this chapter must not rebuild ISP data — it cross-links.

## Why it passes the filter (from original vision)
Not on any listing site. Combines multiple sources. Utilities are a monthly cost forever. The rural-vs-urban service split is genuinely unknown to most buyers. EV buyers need this before they commit.

## Solution
A new chapter module `src/modules/utilities/{data,logic,template}.js`, fetched in `getChapterData` and rendered in `buildChaptersHTML` via `renderChapterCard` with the standard L1–L4 depth structure.

- **Chapter title:** "Utilities & Power."
- **Color:** deep teal `--ch-utilities: #1a6b6b` (water / infrastructure / financial clarity).
- **Placement:** after **Property Costs & Market** (the costs chapter) — the final chapter that completes the "true cost of living here" picture.
- **Tone:** practical and empowering, never alarming. *"Kentucky Utilities' residential rate is about average for the state; statewide, utilities average ~1.4 outages a year. Most are weather-related."*

### Scope (v1 — "solid core first")
- **In:** electric provider + inferred type + residential rate vs state average; state-average reliability context; gas/water/sewer likely-service inference; EV charging (nearest L2 + DC-fast + cost-per-charge).
- **Cross-linked, not rebuilt:** ISP/internet → Property chapter.
- **Deferred (post-v1):** address-level outage history (SAIDI/SAIFI by utility); net metering / solar; EPA SDWA water-system violations; well-depth-by-geology; municipal-vs-private trash & recycling + collection frequency; M-Lab/Ookla actual-vs-advertised speeds; per-commute annual EV cost (→ FR-033).

## Data Layer — `data.js` (fetch only, no HTML, no business rules)

### `getElectricData(lat, lng)`
- **Source:** NREL Utility Rates API v3 — `https://developer.nrel.gov/api/utility_rates/v3.json?api_key=<key>&lat=<lat>&lon=<lng>`
- **Key:** `process.env.NREL_API_KEY` at call time; fall back to `DEMO_KEY`. `AbortSignal.timeout(12000)`.
- **Returns:** `{ utilityName, residentialRate }` (residentialRate = `outputs.residential`, $/kWh) — or `null` on missing data / error / non-ok response.

### `getEvChargingData(lat, lng, originLatLng, getDriveTime)`
- **Source:** NREL Alternative Fuel Stations — `.../alt-fuel-stations/v1/nearest.json?api_key=<key>&latitude=<lat>&longitude=<lng>&fuel_type=ELEC&radius=infinite&limit=20&status=E&access=public`
- **Returns:** `{ level2: {name, address, driveTimeMinutes, distanceMiles} | null, dcFast: {…} | null }` — nearest public L2 (connector includes J1772/L2) and nearest public DC-fast (DC_FAST count > 0). Drive time via injected `getDriveTime` (module never calls Google directly). `null` if no key/data.

> Both calls run under `Promise.allSettled` inside a single `getUtilitiesData(...)` exported entry, mirroring `getPropertyIntelligence`.

## Logic Layer — `logic.js` (business rules, zero HTML, zero API)

### `getElectricRateContext(residentialRate, state)`
- Compares `residentialRate` to `STATE_AVG_ELECTRIC_RATE[state]` (constants).
- Returns `{ rate, stateAvg, delta, deltaLabel, color, narrative }` where `deltaLabel ∈ {'below state average','near state average','above state average'}` (bands: <−7% below, ±7% near, >+7% above). **No score** (CONSTRAINT-001) — factual delta only. `color` is a semantic badge color (green/gold/orange), not a grade.
- Returns `null` if rate or state-avg unavailable.

### `getUtilityType(utilityName)`
- Name heuristics → `{ type, label, hedge }`:
  - `/co-?op|cooperative|rural electric|emc|rec\b/i` → `'cooperative'`
  - `/city of|municipal|public (power|util)|board of public|^[a-z ]+ utilities$/i` → `'municipal'`
  - else → `'investor-owned'`
- Every label phrased "appears to be a …" (inference, not authoritative). Returns `null` if no name.

### `getOutageContext(state)`
- Looks up `STATE_AVG_RELIABILITY[state]` → `{ saidiHours, saifiEvents, narrative }`, labeled **state-level average, excluding major events**. `null` if state missing.

### `getServiceInference(ruralMode)`
- `rural`/`remote` → `{ water:'likely private well', sewer:'likely septic', gas:'likely propane or electric-only' }`
- `urban`/`suburban` → `{ water:'likely municipal', sewer:'likely municipal sewer', gas:'likely natural gas available' }`
- Every field carries `verify: true` and a generic action ("confirm with the seller's disclosure or the county"). Inference only — never stated as fact.

### `getEvChargingCost(residentialRate)`
- One representative full charge = `EV_BATTERY_KWH_REF (60) × residentialRate`, plus a home-charging feasibility note. Returns `null` if no rate.

## Template Layer — `template.js` (HTML only, semantic classes, zero API/logic)

`buildUtilitiesHTML(utilities)` → `renderChapterCard('utilities', '<num>', icon, 'Utilities & Power', subtitle, null, body, null, fullHTML, null, glanceHTML)`.

- **L1 Glance:** `provider · rate-vs-state-avg` (e.g. "Kentucky Utilities · near state avg").
- **L2 Body:** Electric (provider, inferred type, rate-vs-state narrative + badge); Reliability (state-level context); Likely Services (gas/water/sewer inference + verify note); `key-takeaway` block.
- **L3 Deep Read** — tabbed (`climate-tab` pattern): *Electric* · *Reliability* · *EV Charging* (nearest L2 + DC-fast w/ drive time, cost-per-charge, home-charging note).
- **L4 Research** — direct links: NREL utility-rate lookup, EIA reliability data, utility outage-map search, county/city utility-service-area search, **cross-link to Property → Internet Providers** for ISP.

## Constants (`src/utils/constants.js`)
- `STATE_AVG_ELECTRIC_RATE` — `{ [state]: $/kWh }`, all 50 + DC (EIA residential averages).
- `STATE_AVG_RELIABILITY` — `{ [state]: { saidiHours, saifiEvents } }` (EIA-861, excl. major events).
- `EV_BATTERY_KWH_REF = 60`.

## Wiring
- `src/services/reportBuilder.js` already computes `ruralMode` early (before `getChapterData`, lines ~52–65) but doesn't forward it. Pass it into `getChapterData` as a param.
- `src/chapters.js`: accept `ruralMode`; add `getUtilitiesData(...)` to `getChapterData`'s `Promise.allSettled`, passing `lat, lng, originLatLng, locationInfo, getDriveTime, ruralMode`; add `utilities: val(utilities)` to the return; add `buildUtilitiesHTML(chapters.utilities)` to `buildChaptersHTML`, placed **after** `buildPropertyDataHTML` (Costs). The late climate-path `ruralMode` recompute stays untouched (out of scope).
- `public/design-tokens.css`: add `--ch-utilities: #1a6b6b`.
- `.env.example`: add `NREL_API_KEY=your_key_here`.

## Inputs
- `lat, lng, originLatLng` — origin coordinates.
- `locationInfo` — `{ state, county, city }`.
- `getDriveTime` — injected Google drive-time fn.
- `ruralMode` — `'urban'|'suburban'|'rural'|'remote'` (computed upstream in reportBuilder, threaded through getChapterData).

## Constraints
- CONSTRAINT-001: no scores/grades — rate & reliability are factual deltas/context only.
- CONSTRAINT-004: no brand names in any search/filter; utility names are inbound content.
- CONSTRAINT-006: report origin-state utility + origin-state comparison; cross-state territory noted, never a wrong-state finding.
- CONSTRAINT-008/009: no inline styles; no HTML/CSS in data/logic; no API/logic in template.
- CONSTRAINT-011: tests for every logic rule; all 5 addresses incl. Jeffersonville IN.
- CONSTRAINT-014: rural mode comes from the shared logic layer, not recomputed here.
- CONSTRAINT-015: missing NREL key/data → named, actionable fallback (NREL lookup / state PUC), never silence.

## Acceptance Criteria
- [ ] `utilities/{data,logic,template}.js` exist and follow the three-layer rule.
- [ ] Electric provider + inferred type + rate-vs-state-avg render at L2; `null` rate → actionable fallback.
- [ ] Georgetown KY resolves to **Kentucky Utilities**; Bozeman MT to **NorthWestern Energy** (live-data sanity check, not a hardcoded assertion).
- [ ] State-level reliability context renders, clearly labeled state-level.
- [ ] Service inference flips correctly: Harlan KY (rural) → well/septic; Georgetown/Louisville (suburban/urban) → municipal. Always shows a verify action.
- [ ] L3 EV tab shows nearest L2 + DC-fast with drive time + cost-per-charge; graceful fallback if none.
- [ ] L4 cross-links to Property Internet tab; no ISP data rebuilt here.
- [ ] No scoring, no inline styles, no brand names in search/filter.
- [ ] `tests/modules/utilities.test.js`: a test per logic rule + missing-data fallbacks.
- [ ] All 5 test addresses render the chapter without error.
- [ ] `.env.example` documents `NREL_API_KEY`; chapter degrades gracefully with `DEMO_KEY`/no key.
