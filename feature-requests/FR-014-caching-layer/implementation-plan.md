# FR-014 — Caching Layer: Implementation Plan

## Approach

File-based cache using Node's built-in `fs` and `crypto` modules — no new npm packages. A `Cache` class in `src/cache.js` stores JSON blobs keyed by MD5 hash under `.cache/` at the project root. Three caches with different TTLs cover geocoding, place results, and drive times. Cache checks wrap every API-calling function in `app.js`.

## Files changed

- `src/cache.js` (new) — `Cache` class, three named cache instances (`geocodeCache`, `placesCache`, `driveTimeCache`), `cacheStats()` helper
- `src/app.js` — require cache module; add cache check+set in `geocodeAddress`, `getDriveTime`, `getTrafficVariations` (per slot), and all 10 `findNearest*` functions; add `/admin/clear-cache` and `/admin/cache-stats` routes
- `.gitignore` — add `.cache/` and `data/`

## Key decisions

- **Three caches, not four** — spec listed a `reportCache` for full HTML, but full report caching is skipped: it complicates `reportId` tracking, doesn't work cleanly with custom destinations, and function-level caching already reduces a re-run to <1 s (zero API calls).
- **Per-slot traffic caching** — each of the 4 traffic time slots is cached individually under `driveTimeCache` keyed by `traffic:${origin}:${dest}:${slotLabel}`. Slots share the 24-hour TTL with regular drive times.
- **Drive-time cache key** — `${origin}:${dest}` (no timestamp). The 24-hour TTL handles freshness; including the departure timestamp would cause cache misses for the same day across restarts.
- **Sync fs ops** — consistent with the spec and the existing `reports.json` storage pattern; acceptable for a dev-scale prototype.
