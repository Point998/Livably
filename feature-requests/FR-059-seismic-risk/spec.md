# FR-059 — Seismic Risk (Climate chapter enhancement)

## Problem
The Climate chapter covers the address's natural hazards — flood zone, tornado, winter, heat — but **not earthquake risk**. For seismically active areas (the Bozeman MT test address sits at ~4× the ground motion of the KY addresses), that's a real, differentiated gap. This adds seismic hazard to Climate, where it belongs (not a new chapter — per the "fit data into the right chapter" principle).

## Solution
Add a seismic-hazard finding to the **Climate** module, sourced from the USGS Seismic Design Web Service, expressed as a descriptive **band** (not a score), with **adaptive placement**: always at L3, promoted to L2 only when the hazard is moderate or higher.

## Data Layer — `src/modules/climate/data.js`

### `getSeismicHazard(lat, lng)` (fetch only)
- **Source:** `https://earthquake.usgs.gov/ws/designmaps/asce7-16.json?latitude=<lat>&longitude=<lng>&riskCategory=II&siteClass=D&title=livably` (constant `SEISMIC_DESIGNMAPS_URL`). `AbortSignal.timeout(10000)`. `riskCategory=II` (standard residential) and `siteClass=D` (default stiff soil — actual site class needs a geotechnical test) are fixed **modeling assumptions**, disclosed in the L3/L4 source line so the figure isn't over-read as parcel-specific.
- **Returns:** `{ pga, ss, s1, sds }` (numbers from `response.data`) — or `null` on non-ok / throw / missing `pga`.
- **Cell-cached (FR-058 parity):** snap to a cell (reuse `snapToCellAtResolution` at `WATERSHED_CELL_RESOLUTION`, the existing static-geo resolution); key a new **`seismicCache`** (90-day TTL — the hazard model updates ~every 6 years) by `cellId`; search from the cell centroid. Negative results cached as `{ pga: null }` (mirrors `getNamedWatershed`); transient errors not cached.

### Wiring into `getClimateHistoryData`
- Add `getSeismicHazard(lat, lng)` to the existing `Promise.allSettled`.
- Compose `seismic: getSeismicContext(rawSeismic)` (logic) into the returned `climateHistory` object (or `null`).

## Logic Layer — `src/modules/climate/logic.js`

### `getSeismicContext(raw)` (pure, no IO/HTML)
- Input `raw = { pga, ss, s1, sds } | null`.
- Returns `null` if `raw` or `raw.pga` is missing.
- Bands from **PGA (g)** — `PGA_BAND_THRESHOLDS` in constants:
  | PGA (g) | band | label | color |
  |---|---|---|---|
  | `< 0.05` | `very-low` | Very low seismic hazard | green |
  | `0.05–0.10` | `low` | Low seismic hazard | green |
  | `0.10–0.20` | `moderate` | Moderate seismic hazard | gold |
  | `0.20–0.40` | `high` | High seismic hazard | orange |
  | `≥ 0.40` | `very-high` | Very high seismic hazard | red |
- Returns `{ pga, ss, s1, sds, band, label, color, promote, narrative }` where:
  - `promote` = `band ∈ {moderate, high, very-high}` (drives L2 placement).
  - `narrative` — factual, non-alarming (Climate's voice). E.g. low: *"USGS models low earthquake ground motion here (peak ground acceleration ~Xg). Standard residential construction is well within tolerance; seismic retrofitting isn't a concern at this address."* High: *"This is seismically active country — USGS models peak ground acceleration at ~Xg. Confirm the home was built to or retrofitted for modern seismic code, and ask the inspector about foundation bracing and water-heater strapping."*
- **No score** (CONSTRAINT-001) — band + factual narrative only.

`PGA_BAND_THRESHOLDS` is the single source for thresholds (logic reads it; tests assert against it).

## Template Layer — `src/modules/climate/template.js`

### L2 — promoted row (only when `seismic.promote`)
In `buildClimateChapterHTML`'s `leftHTML`, render a `prem-climate-row` (mirroring `tornadoHTML`) **only when `climateHistory?.seismic?.promote`**:
```
🌐 Earthquake Risk  <badge color=seismic.color>seismic.label</badge>
<p>seismic.narrative</p>
```
Low/very-low addresses add nothing at L2.

### L3 — "Seismic" tab (always, when `seismic` present)
Add a 7th tab to `buildClimateDeepDiveHTML`'s `tabs` array: `{ id: 'seismic', label: 'Earthquake', content: buildSeismicTab(seismic) }`. Content: the band + narrative, a plain-language note on what the design values mean (SS = short-period spectral acceleration, etc.), and the USGS source disclaimer. If `seismic` is null, omit the tab (don't render an empty one).

### L4 — research table (when `seismic` present)
In `buildClimateResearchHTML`, add a `climate-research-section` with a small table of the ASCE 7-16 design values (PGA, SS, S1, SDS) + a USGS source line that discloses the `riskCategory II` / `siteClass D` assumptions, and a link to the USGS hazard tool.

### Fallback (CONSTRAINT-015)
When `seismic` is null, the Seismic tab/row/table are simply omitted (the chapter already renders its flood/storm content). The L3 deep-dive's existing disclaimer suffices; no silent "data unavailable" box. (Seismic is supplementary, not the chapter's spine — omission is acceptable, unlike a chapter whose entire purpose failed.)

## Constants — `src/utils/constants.js`
- `SEISMIC_DESIGNMAPS_URL = 'https://earthquake.usgs.gov/ws/designmaps/asce7-16.json'`
- `PGA_BAND_THRESHOLDS` — ordered band cutoffs `[ {max:0.05,band:'very-low',...}, … ]`.
- `SEISMIC_CACHE_TTL_DAYS = 90`.

## Cache — `src/cache.js`
- Add `seismicCache = new Cache('seismic', 60*60*24*SEISMIC_CACHE_TTL_DAYS)`; add to `cacheStats` breakdown + exports.

## Inputs
- `lat, lng` — origin coordinates (existing `getClimateHistoryData` args).
- No new report-level inputs; no new API key (USGS is keyless).

## Constraints
- CONSTRAINT-001: descriptive band, never a numeric score/grade.
- CONSTRAINT-008/009: no inline styles; data fetches only, logic categorizes, template renders.
- CONSTRAINT-011: tests for every band boundary, Bozeman=high / Georgetown=low, null path; all 5 addresses render Climate without error.
- CONSTRAINT-015: null seismic → omitted gracefully (supplementary finding).
- Cost (FR-058): cell-cached, 90-day TTL; centroid search; negative results cached.

## Acceptance Criteria
- [ ] `getSeismicHazard` returns `{pga,ss,s1,sds}` for a valid point, `null` on failure; cell-cached (second same-cell call makes zero USGS calls); negative cached.
- [ ] `getSeismicContext` maps PGA→band per `PGA_BAND_THRESHOLDS`; Georgetown (~0.084) → `low`, Bozeman (~0.30) → `high`; `promote` true only for moderate+.
- [ ] L3 "Earthquake" tab renders when seismic present; omitted when null.
- [ ] L2 seismic row renders **only** when `promote` (moderate+); absent for the KY/IN/low addresses.
- [ ] L4 design-values table + USGS source present when seismic present.
- [ ] No scoring, no inline styles; three-layer split preserved.
- [ ] All 5 test addresses render the Climate chapter without error (Bozeman shows the promoted L2 row; the four low-seismic addresses do not).
