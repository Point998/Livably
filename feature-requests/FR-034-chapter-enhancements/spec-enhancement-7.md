# FR-034 Enhancement 7 — Microclimate Context

## Goal
Add a "Your Microclimate" subsection to the Garden chapter Overview.

## What It Shows
1. Elevation at the address (from USGS EPQS, optional — gracefully absent when unavailable)
2. Solar noon angle at summer solstice vs winter solstice (from latitude, always shown)
3. Shadow length for a 6-foot reference object at winter noon (from winter solar angle)
4. One-sentence practical implication for garden orientation

## Data Sources
- USGS EPQS: `https://epqs.nationalmap.gov/v1/json` — single-point elevation in feet
- Solar math: pure calculation from latitude, no API

## New Functions
- `getMicroclimateData(lat, lng)` in `src/modules/garden/data.js`
  - Returns: `{ lat, elevationFt, solarSummerDeg, solarWinterDeg }`
- `buildMicroclimateHTML(microclimate)` in `src/modules/garden/template.js`
  - Uses existing CSS classes only — no new CSS

## Constraints Met
- CONSTRAINT-008: no inline styles — tested explicitly
- CONSTRAINT-009: no HTML in data.js; no API calls in template.js
- CONSTRAINT-015: section absent when microclimate is null
