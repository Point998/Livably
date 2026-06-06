# FR-034 Enhancement 6 — Named Watershed Context

**Chapter:** Climate & Weather Risks
**Status:** Spec
**Date:** June 2026

## What

Surface the **named watershed** an address sits in, as deep-read context in the Climate chapter. Today the chapter reports only *topographic position* (does water pool toward this lot) from local elevation deltas — it never names the watershed or explains the parcel's place in the larger drainage system. This enhancement adds:

- **L3 (Deep Read):** a brief factual callout of the watershed name, folded into the existing Flood History tab.
- **L4 (Research):** a short interpretive "what it means" block — what a watershed is, the larger river basin it rolls up to, and how that connects to the parcel's drainage position already noted at the base level.

The casual L1/L2 glance is intentionally left unchanged — this is reward for reading deeper, not a headline. It is framed as neutral orientation ("Cool Things to Know"), never as a risk.

## Scope (v1)

**In:** named HUC-12 sub-watershed + larger HUC-8 basin name. Both verified available from USGS WBD.

**Out (documented future work):** the nearest/draining stream's proper name. NLDI returns the draining flowline's geometry and `comid` but **no `gnis_name`**; resolving the name requires an unverified cross-API lookup (comid → NHD/EPA flowline attributes). Per the project's API-assumption discipline (PM-002, PM-004), this is deferred until a reliable `gnis_name` source is verified end-to-end. A direction-only stream clause without a name was rejected as filler.

## What's Already There

- `getWatershedContext(lat, lng)` in `climate/data.js` — samples 5 USGS EPQS elevation points and returns `{ elevations, position }` (`lowpoint` / `uphill` / neutral). **Unchanged by this enhancement.**
- `climateHistory.watershed` shape: `{ topographicPosition, elevations }`. This enhancement **extends** it with a `named` field rather than adding a parallel object.
- `buildWatershedHTML(watershed)` in `climate/template.js` — the base-level topographic line. **Unchanged.**
- `buildFloodTab(floods, femaDeclarations, county)` — the L3 Flood History tab. Receives a new param.
- `buildClimateResearchHTML(climateHistory)` — the L4 research block. Restructured (see Edge Cases).
- `computeBearing` / `bearingToCompass` in `geo.js` (from enhancement 5) — available if the stream clause is ever added; **not used in v1**.
- CSS classes already exist and are reused — no new CSS: `.climate-event-group`, `.climate-event-group-label`, `.climate-research-section`, `.climate-research-section-label`, `.prem-narrative-body`.

## Data Layer (`src/modules/climate/data.js`)

New `getNamedWatershed(lat, lng)`:

1. **HUC-12 query** (USGS Watershed Boundary Dataset, ArcGIS MapServer layer 6):
   `https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/6/query?geometry={lng},{lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=huc12,name&returnGeometry=false&f=json`
   → `features[0].attributes.name` (e.g. `"Dry Run-North Elkhorn Creek"`), `.huc12` (e.g. `"051002050805"`).
2. **HUC-8 basin query** (same service, layer 4) by the same point → basin `name` (e.g. the subbasin that `05100205` belongs to).

- Keyless, national (CONUS) public APIs. **No new npm dependency** — uses the existing `fetch` + `AbortSignal.timeout` pattern already in the file (8–10s timeout).
- Returns `{ huc12Name, basinName }`, or `{ huc12Name, basinName: null }` if only the basin query fails, or `null` if the HUC-12 query fails.
- Wired into `getClimateHistoryData`'s existing `Promise.allSettled` batch alongside `getWatershedContext`. The result is folded into the watershed object:
  ```
  watershed: watershed
    ? { topographicPosition: watershed.position, elevations: watershed.elevations, named: namedWatershed }
    : (namedWatershed ? { topographicPosition: null, elevations: null, named: namedWatershed } : null)
  ```
  (The named watershed renders even if elevation sampling failed but the WBD query succeeded.)

**Caching:** watershed is identical for every address in a geographic cell, so this uses the **FR-058 cell-level cache** (`snapToCell`, H3) — one fetch per cell, reused by all neighbors. No per-address fetch.

**No HTML, no CSS, no display formatting in this layer (CONSTRAINT-009).** Raw names are returned verbatim; en-dash conversion and prose are template concerns.

## Template Layer (`src/modules/climate/template.js`)

### L3 — "Your Watershed" group in the Flood History tab
`buildFloodTab` gains a `namedWatershed` param. When `namedWatershed?.huc12Name` is present, append a `.climate-event-group`:

```
<div class="climate-event-group">
  <div class="climate-event-group-label">Your Watershed</div>
  <p class="prem-narrative-body">This home sits in the <strong>Dry Run–North Elkhorn Creek</strong> watershed.</p>
</div>
```

Thematically fits — the Flood tab already opens on whether the property "drains well enough." Omitted entirely when `namedWatershed` is null.

### L4 — "Watershed Context" block in research
`buildClimateResearchHTML` gains a `buildWatershedContextHTML(watershed)` block, rendered as a `.climate-research-section`. Prose adapts to the available data and to `topographicPosition`:

> A watershed is the area of land where all rainfall drains to a common point. This home's watershed — **Dry Run–North Elkhorn Creek** — is part of the larger **Kentucky River basin**. [If lowpoint:] Combined with the parcel's low-lying position noted above, runoff from uphill in this same basin moves toward and past this property — which is why local drainage, not just the FEMA zone, governs how this lot handles heavy rain. [If uphill:] With the parcel sitting above the surrounding terrain, runoff tends to move away from the home rather than toward it. [If neutral/unknown:] (drainage tie-back clause omitted.)

- The basin clause is omitted gracefully if `basinName` is null.
- Tone: factual orientation, not alarm. No scoring (CONSTRAINT-001).

## Edge Cases

- **L4 must render independently of storm events.** `buildClimateResearchHTML` currently early-returns `''` when there are no storm events (`climate/template.js:386`). Restructure so the watershed-context block can render even when the storm-event and normals tables are empty.
- **Topographic tie-back coherence:** the L4 drainage sentence must match the actual `topographicPosition`. Never reference a "low-lying position" when the parcel is uphill or neutral.
- **HUC-12 compound names:** WBD names are often hyphenated compounds ("Dry Run-North Elkhorn Creek"). Display verbatim, converting the hyphen to an en-dash in the template only.
- **Point in open water / no HUC:** rare in CONUS; HUC-12 query returns no feature → `getNamedWatershed` returns null → both sections omitted.
- **Partial failure:** HUC-12 succeeds, HUC-8 fails → show watershed name, omit the basin clause.

## Graceful Degradation (CONSTRAINT-015)

`named` null → both the L3 group and the L4 block are omitted. The existing topographic line, flood narrative, action checklist, and all other content are unaffected. No placeholder, no "data not available."

## Acceptance Criteria

- L3 "Your Watershed" group shows the HUC-12 name when available; absent when `named` is null.
- L4 "Watershed Context" block shows the meaning + basin rollup + topography-matched drainage tie-back; absent when `named` is null; **renders even when there are no storm events**.
- Basin clause omitted gracefully when `basinName` is null.
- Drainage tie-back wording matches `topographicPosition` (no low-point language on uphill/neutral parcels).
- No scoring or grades (CONSTRAINT-001).
- No inline styles; only existing CSS classes reused (CONSTRAINT-008).
- No HTML/CSS in `data.js`; no API calls in `template.js` (CONSTRAINT-009).
- Tested on all 5 addresses, with **Jeffersonville IN as the explicit location-search regression case** (CONSTRAINT-011).

## Tests

- `tests/modules/climate/data.test.js` — `getNamedWatershed`: full result, basin-null (HUC-8 fail), null (HUC-12 fail). Mock both WBD fetches.
- `tests/modules/climate/template.test.js` —
  - L3 group present with name; absent when `named` null.
  - L4 block present with basin; basin clause absent when `basinName` null.
  - L4 tie-back: lowpoint vs uphill vs neutral wording.
  - L4 renders with watershed present but **no storm events**.
  - No inline styles in rendered output.

## API Notes

- USGS WBD (ArcGIS): `https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer` — layer 6 = HUC-12, layer 4 = HUC-8. No auth, no documented rate limit. Verified live for Georgetown KY (returns `Dry Run-North Elkhorn Creek` / `051002050805`).
- Both fetches wrapped in try/catch with timeouts; failures degrade per CONSTRAINT-015.
- No new npm package. No `.env` changes.
