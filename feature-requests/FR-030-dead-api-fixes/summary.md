# FR-030 — Dead API Fixes: Property Intelligence + Sensory Environmental

**Date:** 2026-05-22

## What Was Fixed

### Property Intelligence (src/premium.js)

**FCC Broadband (was: 405 Method Not Allowed)**
- Root cause: FCC National Broadband Map API changed; endpoint consistently returns 405 for all GET/POST requests
- Fix: When `getBroadbandData` returns null (already graceful), updated display fallback from generic "data not accessible" to specific action item with direct link to [FCC National Broadband Map](https://broadbandmap.fcc.gov/)

**County Assessor Link**
- Root cause: Tax/permit section was plain text with no clickable link
- Fix: Added Google search link generator → `https://www.google.com/search?q={county}+county+assessor+property+records` — takes user directly to county assessor search results; works for any US county

### Sensory Environmental (src/premium.js)

**EPA ECHO SDW Water Quality (was: 500 Internal Server Error)**
- Root cause: `echodata.epa.gov` SDW REST services endpoint returning 500
- Fix: When `getWaterQuality` returns null, updated fallback to include direct link to [EWG's Tap Water Database](https://www.ewg.org/tapwater/) — users can search by zip code for historical violations

**EPA EJSCREEN (was: domain unreachable, 000)**
- Root cause: `ejscreen.epa.gov` API endpoint is unreachable (domain-level failure, likely deprecated API)
- Fix: When `getEJScreen` returns null, updated fallback from "data not available" to actionable item with link to [EPA EJSCREEN web tool](https://ejscreen.epa.gov/mapper/) where users can manually check environmental hazard proximity

**Road Noise Estimation Fallback (BTS 000 + OSM unreliable)**
- Root cause: `gis.bts.gov` ArcGIS service unreachable; Overpass API (OSM fallback) returns 406 or times out
- Fix: Added third fallback in `getEnvironmentalData`: when `roadNoise` is null AND `_highwayDriveMinutes` is available, estimate based on highway proximity:
  - ≤5 min → 65 dB (at residential threshold)
  - 5–15 min → 55 dB (moderate)
  - >15 min → 45 dB (quieter)
  - Source tagged as 'estimated from highway proximity' — matches existing OSM estimation display logic

## Verification
- `node -e "require('./src/premium.js')"` — no syntax errors ✅
- `node -e "require('./src/app.js')"` — no syntax errors ✅
- All 3 test addresses (Georgetown, Harlan, Louisville) load without errors ✅
- Premium sections are gated — full visual test requires Stripe key or manual premium flag in reports.json (tested with manual flag; no render errors) ✅

## APIs Tested
- FCC Broadband: 405 (confirmed dead, fallback active)
- EPA ECHO SDW: 500 (confirmed dead, fallback active)  
- EPA EJSCREEN ejscreen.epa.gov: 000 (domain dead, fallback active)
- BTS Noise Map gis.bts.gov: unreachable (highway proximity estimation fallback added)
- Overpass API (OSM fallback): 406 on main endpoint, timeout on lz4 (already graceful)
