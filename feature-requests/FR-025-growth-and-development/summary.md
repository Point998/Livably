# FR-025 — Growth & Development — Implementation Summary

## What Was Built

Chapter card "Growth & Development" added to the standard tier report, rendered via `buildGrowthAndDevelopmentHTML` in `src/premium.js`.

## Data Sources

### Census BPS API (building permit trend)
- Attempted endpoint: `https://api.census.gov/data/timeseries/eits/bps`
- **Status:** API returned 404 for all county-level queries — endpoint does not accept this format server-side
- **Fallback applied:** Census ACS variables B25034_001E–B25034_003E (year structure built) provide new construction percentage at the tract level

### Census ACS New Construction Context (fallback, active)
- Variables: B25034_001E (total units), B25034_002E (built 2014+), B25034_003E (built 2010–2013)
- Returns `newConstructionPct` — % of housing built after 2010
- Feeds the lead narrative: "16% of housing in this Census tract was built after 2010..."

### Google Places API (commercial landscape)
- `placesNearby` with 6 commercial types within 2,400m
- Types: shopping_mall, supermarket, department_store, gym, movie_theater, bank
- Deduplicates by `place_id`, sorts by distance, returns up to 6
- Shows "Commercial Landscape Within 1.5 Miles" card

## Functions Added
- `getBuildingPermitTrend(fips)` — Census BPS (gracefully returns null)
- `getNewConstructionContext(fips)` — ACS fallback for permit trend
- `getRecentDevelopmentActivity(lat, lng, client, key)` — Google Places commercial
- `getGrowthAndDevelopment(...)` — master orchestrator
- `buildGrowthAndDevelopmentHTML(growth)` — HTML builder

## Output Behavior
- **If BPS works:** Uses permit count + year-over-year % change + trend label
- **If ACS fallback:** Uses new construction % with context narrative
- **If no data:** Directs buyer to county planning department
- Commercial landscape shown with distance, icon, type
- Key Takeaway based on growth trend or commercial density
- Always ends with planning department guidance for pipeline projects

## Update: Manual Development Intelligence Database (2026-05-21)

Added `src/development-intel.js` — a city-keyed database of manually verified development projects that are shown prominently in the chapter before the automated Census/Places data.

**Georgetown, KY entries:**
- Publix Supermarket — Under Construction, Q4 2026
- Target — Approved, Early 2027

**How it works:**
- `getLocalDevelopmentIntel(city, state)` is called inside `getGrowthAndDevelopment()` and returned as `namedProjects`
- `buildGrowthAndDevelopmentHTML` renders them as a gold-bordered card at the top of the chapter (before the permit narrative)
- Status badges are color-coded: green (Under Construction), gold (Approved), purple (Planned)
- Key Takeaway is overridden to reference the named project when one exists
- Source line reads "Livably Development Intelligence (manually verified)"
- Louisville, KY and other cities without entries return an empty array (no section rendered)

**To add a new city:** Add a `'city,state'` key to the `DATABASE` object in `src/development-intel.js`.

---

## Deviations from Spec
- Phase 2 (county planning portal scraping) deferred as specified
- DOT project database integration deferred — no unified national API
- Census BPS county-level API unavailable; ACS new construction % is the working signal
- FCC Broadband API (used in FR-026) also restricted — both noted in FR-026 summary

## Testing
- Georgetown, KY: 16% new construction, 6 commercial establishments found ✅
- Louisville, KY: 14% new construction, urban commercial establishments ✅
- Harlan, KY: 4% new construction (established neighborhood narrative) ✅

## CSS Added
`public/report.css`: `.prem-growth-section`, `.prem-growth-label`, `.prem-growth-places`, `.prem-growth-place`, `.prem-growth-place-*`
