# FR-063 — Source-Verification Harness · Discovery

*Phase 1 (read-only). June 2026.*

## Problem

Livably's graceful-degradation discipline (CONSTRAINT-015) means every external
fetch returns `null`/`[]` on failure and the template renders an actionable
fallback. This is correct for UX but creates **observability debt** (NR-004
thread): a source that has gone fully dead looks identical to a source that
legitimately has no data for an address. Two real outages hid this way:

- **FCC broadband 405** — endpoint returning 405, masked behind the Utilities fallback.
- **NREL DNS failure** — dev-environment DNS block, masked behind the Utilities fallback.

We want dead sources **surfaced**, not silently masked.

## What exists today

- **14 modules**, each with `src/modules/<name>/data.js` owning its API fetches.
  A single module can wrap many external endpoints. Climate alone has six:
  NOAA CDO normals, NOAA storm-events (pre-cached JSON), FEMA declarations,
  USGS elevation, WBD watershed, USGS seismic.
- Every fetch helper already swallows failure (`catch { return null }` / `return []`)
  and most apply `AbortSignal.timeout(...)`.
- **Shared context helpers** the harness can reuse to build per-address inputs:
  - `src/shared/google/geocoding.js` → `geocodeAddress(address)` → `{ lat, lng }`
  - `src/shared/google/reverseGeocode.js` → `reverseGeocodeAddress({lat,lng})` → `{ city, state, county, zip }` (state = 2-letter, county = "X County")
  - `src/shared/census.js` → `getCensusFIPS(lat, lng)` → `{ state, county, tract }` (numeric FIPS)
  These are exactly the inputs module fetchers consume (`locationInfo.state/county`, `fips.state/county`).
- **CI exists** (`.github/workflows/ci.yml`, FR-064) — runs `npm test` on push/PR,
  Node 20.x + 22.x. This is what turns FR-063 from a manual script into a
  scheduled monitor (NR-004 Stage 2 intent, pulled forward as a standalone workflow).
- **Config contract** (`src/config.js`, FR-064): `GOOGLE_MAPS_API_KEY` required;
  optional keys `NOAA_CDO_API_KEY`, `NREL_API_KEY`, `EIA_API_KEY`, `CENSUS_API_KEY`,
  `AIRNOW_API_KEY`, `OPENCHARGEMAP_API_KEY`. These become the workflow's repo secrets.

## What's missing

- No repeatable check that a live source returns *real* data for the 5 test addresses.
- No catalogue of which external endpoints each module depends on.
- No machine signal when a primary source dies.

## What could break / risks

- **Cost & flakiness**: the harness makes live metered calls (Google especially)
  across 5 addresses. It must NOT run on push/PR — scheduled + manual only.
- **False positives**: sparse-by-design sources (FEMA, NOAA storm-events) are
  legitimately empty for many addresses. The verdict model must distinguish
  "expected-everywhere" from "expected-sometimes" sources (per-source `coverage`).
- **Missing optional keys**: running without a key must report `SKIPPED (no key)`,
  not `FAIL`, or the monitor lies when run with partial secrets.
- **FCC broadband is deferred** (FR-062, no BDC token) — it must be visible as
  `SKIPPED (deferred)`, never `FAIL`.

## Constraints in play

- CONSTRAINT-011 (tests required) · CONSTRAINT-015 (graceful degradation — this FR
  pays down its observability cost) · the three-layer rule (harness lives in
  `scripts/`, reads `data.js` descriptors; pure verdict logic isolated for testing).
