# FR-034 Enhancement 4 — Healthcare Depth — Implementation Summary

## What Was Built

### New Data Functions (`src/modules/health/data.js`)
- `mapCMSHospitalType(hospitalType)` — pure sync helper mapping CMS hospital type strings to buyer-friendly labels + notes (Acute Care, Critical Access, Children's, Psychiatric)
- `getCMSHospitalType(address)` — async; extracts ZIP from hospital address string, queries CMS Hospital General Information dataset (`xubh-q36u`), returns `{ label, note }` or `null`
- `getPrimaryCareCount(city, state)` — async; runs two parallel NPI Registry API calls (Family Medicine + Internal Medicine) and sums `result_count`; returns integer or `null`
- `getHealthcareDepth(hospital, locationInfo)` — async wrapper calling both above in parallel via `Promise.allSettled`; returns `{ designation, primaryCareCount }`

### Data Flow Changes
- `reportBuilder.js`: imports `getHealthcareDepth`, calls it after the main parallel batch (non-blocking, try/catch), passes result to `buildReportHTML`
- `reportPage.js`: destructures `healthcareDepth` from options, passes as 4th arg to `buildHealthSafetyChapterHTML`

### New "Healthcare Ecosystem" L3 Tab (`src/modules/health/template.js`)
Added `buildHealthcareEcosystemTab(hospital, healthcareDepth)` — new 4th tab in the health chapter deep dive.

**Hospital Type section:**
- If CMS data available: shows designation label + note + CMS Care Compare link
- If not available: direct link to CMS Care Compare with guidance to verify capabilities

**Primary Care Availability section:**
- 5 threshold tiers: null (data unavailable), 0 (none found), ≤5 (limited/competition note), ≤15 (moderate), 16+ (solid)
- Always includes actionable guidance: "contact your insurer for in-network PCPs accepting new patients"
- Source disclaimer: NPI Registry registered practitioners, not necessarily accepting patients

**Graceful degradation (CONSTRAINT-015):** Tab always renders when hospital exists — minimum content is the CMS Care Compare link and insurer guidance. Neither API failure suppresses the tab.

### CSS
Added `.health-ecosystem-section` and `.health-ecosystem-label` to `public/report.css`.

## Test Counts
- +10 new tests in `tests/modules/health/template.test.js`
- Full suite: 1,114 tests / 61 suites — 0 failures (was 1,104 before this enhancement)

## Constraints Verified
- CONSTRAINT-002: content describes institutions and registries — no demographic characterization
- CONSTRAINT-008: no inline styles
- CONSTRAINT-009: data.js has no HTML; template.js has no API calls
- CONSTRAINT-015: tab renders even when both APIs fail

## API Notes
- CMS Hospital Compare: `https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0` — 10s timeout, no auth required
- NPI Registry: `https://npiregistry.cms.hhs.gov/api/` — 10s timeout per call, no auth required
- Both are federal public APIs — no rate limits documented, but both wrapped in try/catch with `Promise.allSettled` for resilience
