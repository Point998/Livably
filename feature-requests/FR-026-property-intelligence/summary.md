# FR-026 — Property Intelligence — Implementation Summary

## What Was Built

Chapter card "Property Intelligence" added to the standard tier report, rendered via `buildPropertyIntelligenceHTML` in `src/premium.js`.

## Data Sources

### USDA Web Soil Survey (SSURGO via SDA)
- Endpoint: `https://sdmdataaccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest`
- Method: POST with `query=<SQL>&format=JSON`
- **Status: Working** — returns muname, drainagecl, hydricrating at coordinate
- Georgetown: "Bluegrass-Maury silt loams, 2 to 6 percent slopes" — Well drained
- Louisville: "Urban land" — no drainage class (handled with urban-specific narrative)
- Note: SDA JSON format returns data rows only (no header row) — positional parsing by SELECT order
- `getDrainageCategory()` maps drainage class to label, color, and practical implication

### FCC National Broadband Map
- Endpoint: `https://broadbandmap.fcc.gov/api/public/map/listAvailability`
- **Status: Returns 405** — endpoint is restricted to browser clients, not accessible server-side
- Graceful fallback: "Broadband availability data was not accessible for this address through the FCC Broadband Map at this time. Verify with local providers."
- Key Takeaway adapts: recommends verifying internet before committing

### Census ACS — Construction Era Context
- Variables: B25035_001E (median year structure built), B25034_001E–003E (year built categories)
- **Status: Working** — returns median year and new construction percentage
- `getConstructionEraContext(year)` returns era label and inspection checklist by decade
- Georgetown: 2003 median year → "2000s construction" (no cautions)
- Harlan: ~1950s era → includes lead paint, plumbing, and asbestos cautions
- Clearly disclosed as tract-level estimate, not parcel-specific

## Functions Added
- `getSoilData(lat, lng)` — USDA SDA POST query
- `getDrainageCategory(drainagecl)` — maps drainage class to user-facing label/implication
- `getBroadbandData(lat, lng)` — FCC API (gracefully returns null)
- `getBroadbandCategory(maxMbps, hasFiber)` — categorizes broadband speed tier
- `getConstructionEraContext(year)` — era label + inspection checklist by decade
- `getPropertyIntelligence(lat, lng, fips, locationInfo)` — master orchestrator
- `buildPropertyIntelligenceHTML(propIntel)` — HTML builder

## Four Sections Rendered
1. **Construction Era** — ACS median year built + new construction % + inspection checklist for older eras
2. **Soil & Drainage** — USDA soil type + drainage class badge + hydric flag + practical implication
3. **Internet Availability** — FCC data (with graceful fallback) + provider cards
4. **Tax & Permit Records** — Direct guidance to contact county assessor/building dept

## Deviations from Spec
- County assessor parcel-level data (permit history, tax trajectory): No unified national API — directs buyer to contact county directly. Spec anticipated this: "Permit records for this jurisdiction require direct inquiry."
- FCC Broadband API restricted server-side — graceful fallback applied
- USDA returns positional JSON (no headers) — required adjusting parsing logic from spec's assumed format

## Testing
- Georgetown, KY: USDA soil works (Well drained), ACS 2003 era, FCC fallback ✅
- Louisville, KY: Urban land (special handling), ACS data, FCC fallback ✅
- Harlan, KY: USDA Well drained, older construction era with cautions, FCC fallback ✅

## CSS Added
`public/report.css`: `.prem-intel-section`, `.prem-intel-label`, `.prem-intel-soil-badge`, `.prem-intel-cautions`, `.prem-intel-caution-list`, `.prem-intel-bb-providers`, `.prem-intel-bb-provider`, `.prem-intel-bb-*`
