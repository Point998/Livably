# FR-072 — USDA soil resilience — Summary

*Phase 4 complete. Track A1, first **non-Google single** slice (after the six
Google→OSM slices FR-066–071). Establishes the hardening pattern for the remaining
non-Google singles (USGS elevation, Census vintage).*

## What shipped

Turned the lone USDA SDA soil fetch — a **silent single point of failure** — into a
resilient, observable one, with an honest, coordinate-specific floor. Improves two
chapters at once (Property + Garden share the `soil` object).

## Shape — settled by the SoilWeb spike, not assumed

The discovery spike probed for a true independent SSURGO source and found **none**:
SoilWeb (UC Davis) exposes no public lat/lng JSON API (every path 404/403; only
HTML browsers), the SDA Spatial service shares the primary's host (no outage
independence), and ISRIC SoilGrids is *modeled* (texture, not drainage/hydric),
rate-limited, and returned `null` on probe. So — per the roadmap's explicit
framing for non-Google singles ("primary → fallback **or** actionable floor") —
FR-072 is **hardened SDA primary → observable, coordinate-specific floor**, not a
fabricated second source. The spike *did* find a working point-specific deep-link
(`/gmap/?loc=lat,lng`, HTTP 200) for the floor.

## Three real, modest wins

1. **Resilience** — `getSoilDataSDA` now distinguishes "no soil mapped" (→ `null`,
   legit) from "fetch failed" (→ throws), with **one retry on transient failure**
   (timeout / network / 5xx; not 4xx), the real failure mode of a single host.
2. **Observability** — `getSoilData` wraps the fetch in `sourceChain` (label
   `property-soil`), so an outage is **recorded in the FR-068 degradation ledger**
   instead of swallowed to `null` by a `try/catch` (the verbatim NR-004 swallow
   debt). The `soil` contract stays object-or-null — every existing `!soil` floor
   across Property + Garden is untouched.
3. **Honest floor** — when SDA is down, the Property soil tab + research link now
   point to the **exact coordinates** in UC-Davis SoilWeb (`soilwebUrl`, always
   computed) instead of the WSS homepage.

## Changes

- **`src/modules/property/data.js`** — split `getSoilData` → `getSoilDataSDA`
  (query + `!resp.ok`→throw, empty-Table→null, **one transient retry**) + public
  `getSoilData` (`sourceChain([sda], …, { label:'property-soil' })`, contract
  unchanged). Added `chainLog`, `isTransientSoilError`, `SOILWEB_GMAP_BASE`.
  `getPropertyIntelligence` now always returns `soilwebUrl` (`/gmap/?loc=lat,lng`).
  `usda-soil` SOURCES descriptor repointed to `getSoilDataSDA` (reports SDA
  specifically; legit-empty accepted, throw = the failure signal).
- **`src/modules/property/template.js`** — `buildSoilTab(soil, soilwebUrl)` adds a
  point-specific SoilWeb link to the unavailable floor; research "Full soil data"
  link uses `soilwebUrl` when present (label adjusted). No CSS/class changes.

## Key discipline — distinguishing empty from failed

Today both an unmapped point *and* a fetch failure collapse to `null`. FR-072
separates them: an empty `Table` returns `null` and **short-circuits the chain as
valid** (no false degradation event, urban-land narrative preserved), while a real
failure *throws* → recorded → `getSoilData` returns `null` (same external value,
now observable). Verified live: Louisville/Bozeman/Jeffersonville correctly return
"Urban land" objects (not the floor); the floor only fires on a genuine SDA outage.

## Tests (CONSTRAINT-011)

- `property/data.test.js` — SDA success (+hydric), empty→null **with no ledger
  event**, 503×2→null **with `error`+`exhausted` ledger events** (uses
  `runWithLedger`/`getLedger`), 503-then-200 retry success, 400→no-retry, SDA
  throws on outage, `getPropertyIntelligence.soilwebUrl` shape.
- `property/template.test.js` — soil-null floor renders the coordinate SoilWeb link.
- **Full suite: 1,607 passed / 83 suites green** (1,598 + 9 new).

## Live verification — all 5 test addresses (real SDA)

| Address | SDA result |
|---|---|
| Georgetown KY | Bluegrass-Maury silt loams · Well drained · hydric No |
| Harlan KY | Udorthents-Urban land complex · Well drained |
| Louisville KY | Urban land (null drainage → urban-land narrative) |
| Bozeman MT | Urban land |
| Jeffersonville IN | Urban land-Udarents complex (IN-side) |

SDA up on all 5; floor link `/gmap/?loc=` → HTTP 200.

## Workflow note

Full 4-phase workflow (discovery + SoilWeb spike → spec → plan → implementation).
No phases skipped. No new npm packages.

## Remaining A1 non-Google singles

USGS elevation, Census vintage — each reuses this pattern (transient retry +
`sourceChain` observability + honest actionable floor).
