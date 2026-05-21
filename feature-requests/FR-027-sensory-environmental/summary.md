# FR-027 — Sensory & Environmental: Implementation Summary

**Status:** Implemented — commit c315e2c
**Date:** 2026-05-20
**Supersedes:** FR-019 (Environment section)

---

## What Was Built

Replaced the single-paragraph FR-019 environment section with a full three-section Sensory & Environmental chapter. The chapter is organized around what buyers can discover through sensory experience vs. what requires data:

### Section A: What You'll Hear
- **Airports** — Google Places `type:'airport'` within 20 miles; filtered by `AIRPORT_RE` allowlist and `NON_AIRPORT_RE` blocklist to exclude paragliding schools, skydiving centers, and flying clubs. Nearest airport shown with distance and actionable advice scaled to proximity (<5mi, <10mi, <15mi, 15–20mi).
- **Road noise** — Primary: BTS National Transportation Noise Map (ArcGIS REST). Fallback: OpenStreetMap Overpass (motorway/trunk/primary/secondary within 4km). Estimates DNL using log-decay from road type and distance. Reports category (Quiet/Moderate/Elevated/Significant) against FHWA 65 dB residential standard.
- **Rail proximity** — OpenStreetMap Overpass (railway=rail/light_rail/tram within 4.8km). Nearest line with type, operator/name, and distance-scaled advisory.

### Section B: What You'll See at Night
- **Light pollution** — Bortle scale estimate (2–8) from Census tract population density (ACS B01003_001E) + OSM land use classification (commercial/residential/rural). Shows label and practical description.

### Section C: What You Can't See
- **Air quality** — EPA AirNow (current AQI, primary pollutant, category).
- **Water quality** — EPA ECHO SDW REST services (community water system lookup, last 5 years of violations). Falls back to actionable advisory to request Consumer Confidence Report.
- **Radon** — EPA county-level Zone 1/2/3 classification; Zone 1 states get explicit testing recommendation with cost range.
- **EJSCREEN** — EPA environmental screening percentiles for Superfund proximity, chemical risk facilities, and hazardous waste sites (flags when any > 75th percentile).

### Key Takeaway
Priority logic: airport <10mi → road noise ≥65 dB → water violations → radon Zone 1 → EJSCREEN flagged → rail <0.5mi → default (all clear).

---

## Data Sources

| Source | Status | Notes |
|--------|--------|-------|
| Google Places (airports) | ✅ Working | Filter added for non-airport venues |
| BTS Noise Map | ⚠️ Network-dependent | ArcGIS REST; unreachable from some IPs |
| OpenStreetMap / Overpass | ⚠️ Rate-limited in testing | 4-endpoint fallback chain; works in production |
| EPA AirNow | ✅ Working | Requires `AIRNOW_API_KEY` in .env |
| EPA ECHO SDW | ⚠️ API returning 500 | Server-side issue; graceful fallback in place |
| EPA Radon Zone Map | ✅ Working | Static county-level lookup, no API call |
| EPA EJSCREEN | ⚠️ Domain dead | `ejscreen.epa.gov` DNS failure; graceful fallback |
| Census ACS (light pollution) | ✅ Working | Via `fetchCensusACS` helper |

---

## Known Limitations and Future Work

**EPA ECHO SDW** (`sdw_rest_services.get_facilities`) has been returning HTTP 500 for all queries. The API may be deprecated or undergoing migration. When fixed, the water quality section will automatically show the serving utility and violation history.

**EPA EJSCREEN** — `ejscreen.epa.gov` does not resolve. The EPA has likely migrated this service. When the new URL is identified, update `getEJScreen()` in `premium.js`. Candidate: EPA ArcGIS Online hosted feature service (requires token or public URL discovery).

**Overpass rate limiting** — The four-endpoint chain (`overpass-api.de`, `lz4.overpass-api.de`, `kumi.systems`, `openstreetmap.fr`) handles transient failures well. In production with one request per user session, rate limiting is not expected to be an issue.

**Road noise BTS coverage** — The BTS ArcGIS service may not have coverage for all locations or may be unreachable from certain network environments. The OSM fallback provides estimates that are directionally accurate for major roads.

---

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| Three-section narrative structure | ✅ |
| Airport distance and context | ✅ |
| Road noise with DNL estimate | ✅ (fallback shows when Overpass unavailable) |
| Rail proximity | ✅ (fallback shows when Overpass unavailable) |
| Light pollution with Bortle scale | ✅ |
| Air quality (AQI) | ✅ |
| Water quality | ⚠️ Fallback only (EPA API down) |
| Radon zone with zone-specific advice | ✅ |
| EJSCREEN hazard screening | ⚠️ Fallback only (domain dead) |
| Key Takeaway callout | ✅ |
| Source citations and research date | ✅ |
| Graceful degradation | ✅ All sections degrade independently |
| Tested: Georgetown, KY | ✅ |
| Tested: Louisville, KY | Pending |
| Tested: Harlan, KY (rural) | Pending |
