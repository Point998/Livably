# FR-014 — Caching Layer: Summary

## What was built

A file-based caching layer that eliminates duplicate Google Maps API calls for repeated address lookups. Every function that calls the Maps API now checks a local `.cache/` file before making a network request. A second report for the same address is served in under 1 second with zero API calls (verified: 40 cache files after first run, 40 files after second run — no new writes).

## Changes

**`src/cache.js`** (new file)
- `Cache` class: `get(key)` checks expiry and returns cached value or `null`; `set(key, value)` writes JSON with `expiresAt`; `clear()` removes namespace files; `stats()` counts files.
- Three instances: `geocodeCache` (90-day TTL), `placesCache` (7-day TTL), `driveTimeCache` (24-hour TTL).
- `cacheStats()` function reads `.cache/` directory and returns file count, total size (KB), and per-namespace breakdown.

**`src/app.js`** — cache checks added to:
- `geocodeAddress` — keyed on normalized address string; `geocodeCache`
- `getDriveTime` — keyed on `origin:dest`; `driveTimeCache`
- `getTrafficVariations` — per-slot cache keyed on `traffic:origin:dest:slotLabel`; `driveTimeCache`
- All 10 `findNearest*` functions — keyed on `{service}:${originLatLng}`; `placesCache`
- New routes: `POST /admin/clear-cache` clears all three caches; `GET /admin/cache-stats` returns JSON breakdown.

**`.gitignore`** — added `.cache/` and `data/` (both contain runtime-generated files that should not be committed).

## Deviations from spec

- No full-report HTML cache — function-level caching already achieves <1 s re-runs; full-report caching would break `reportId` / history tracking and doesn't compose cleanly with custom destinations.
- `POST /admin/clear-cache/:type` (per-type clear) omitted — not needed for the prototype scale.
