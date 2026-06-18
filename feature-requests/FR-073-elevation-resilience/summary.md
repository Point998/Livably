# FR-073 — USGS elevation resilience — Summary

*Phase 4 complete. Track A1, 8th slice / 2nd **non-Google single** (after FR-072
soil). Unlike soil, a verified independent fallback exists — so this slice ships a
real second data source plus observability and de-duplication.*

## What shipped

The two independent USGS EPQS elevation fetches (Climate topographic position,
Garden microclimate) — a flaky single point of failure for both chapters — now go
through one shared, resilient, observable helper: **EPQS primary → OpenTopoData
NED 10 m fallback → honest absence**, with degradation recorded in the FR-068
ledger.

## New shared module — `src/shared/elevation.js`

Joins the `shared/` data-utility family (`overpass`, `osmPlaces`, `census`,
`sourceChain`). Public API:
- `fetchElevationsFeet(points)` — batch; `sourceChain([epqs, opentopo], label
  'elevation')`; returns `feet[]` (null per missing point) or `null`.
- `fetchElevationFeet(lat, lng)` — single-point convenience.
- `fetchElevationWithRetry(url)` — the original EPQS retry primitive, relocated and
  re-exported from `climate/data.js` for back-compat (its tests + the `chapters.js`
  re-export are untouched).

EPQS is queried per point (with the existing 2-retry/5 s/1 s-backoff logic);
OpenTopoData is **one batched call** (`?locations=a|b|…`, meters → feet ×3.28084),
only fired when the EPQS center point misses. `centerPresent` validity: point 0 is
what consumers need; surrounding nulls are fine (Climate fills them) — a null
*center* triggers fallback, then exhaustion → `null`.

## Why a real fallback (vs FR-072 soil's hardened-primary-only)

A live spike confirmed **OpenTopoData `ned10m` serves the same USGS NED 10 m DEM
from an independent host**: Bozeman 1472.57 m → **4831 ft** vs EPQS **4829 ft** —
near-identical. So this is a genuine like-for-like second source, not a modeled
proxy. EPQS's own pre-existing retry machinery is evidence it's flaky, so the
fallback has real value.

## Consumers (logic unchanged)

- **`climate/data.js` `getWatershedContext`** — swaps the inline
  `fetchElevationWithRetry` loop + per-point `logError` for
  `fetchElevationsFeet(points)`; keeps the fill-missing-with-center +
  `classifyTopographicPosition` logic byte-identical.
- **`garden/data.js` `getMicroclimateData`** — swaps the silent `try/catch` for
  `fetchElevationFeet(lat, lng)`; `{ lat, elevationFt, solar… }` shape unchanged;
  solar angles still always computed.

## Observability + a latent bugfix

- Both consumers now record EPQS→OpenTopoData `fallback` and full `exhausted` in
  the **FR-068 ledger** (was: climate `logError`-only, garden *totally silent*).
- **Unified no-data guard** (`null` or `<= -1000` → null) preserves Garden's −9999
  sentinel handling **and** hardens Climate against a −9999 corrupting topographic
  classification (a latent bug — Climate previously didn't filter sentinels).

## Floor

Honest absence (no link) — both templates already degrade by omission (Climate
drops the topographic narrative; Garden drops the elevation note), and there's no
meaningful buyer action for missing ground elevation (unlike FR-072 soil's
SoilWeb deep-link). CONSTRAINT-015 already satisfied.

## Tests (CONSTRAINT-011)

- New `tests/shared/elevation.test.js` — `cleanFeet`, `fetchElevationWithRetry`,
  `epqsPointFeet`, EPQS-primary batch (no OpenTopoData call), **OpenTopoData
  fallback (m→ft) with ledger `fallback` assert**, both-down → null with `error`+
  `exhausted` assert, single-point.
- `climate/data.test.js` + `chapters/climate-data.test.js` — `getWatershedContext`
  asserts updated: dropped the per-point `logError('getWatershedContext',…)`
  exhaustion counts (observability moved to the helper's `sourceChain`), now assert
  null-return + the shared-helper log. `fetchElevationWithRetry` blocks unchanged.
- `garden/data.test.js` — existing cases preserved through the helper; added an
  EPQS-down → OpenTopoData-fallback case.
- **Full suite: 1,621 passed / 84 suites green** (1,607 + 14 new; new shared suite).

## Live verification — all 5 addresses

| Address | EPQS | (fallback parity) |
|---|---|---|
| Georgetown KY | 851 ft | OpenTopoData 258.6 m → 848 ft |
| Harlan KY | 1,186 ft | — |
| Louisville KY | 460 ft | — |
| Bozeman MT | 4,829 ft | OpenTopoData 1472.6 m → 4,831 ft |
| Jeffersonville IN | 448 ft (IN-side) | — |

Climate 5-point batch (Georgetown): `[851, 849, 841, 875, 863]` — realistic
variation. OpenTopoData batch live: HTTP 200, near-identical to EPQS.

## Workflow note

Full 4-phase workflow (discovery + live fallback spike → spec → plan →
implementation). No phases skipped. No new npm packages.

## Remaining A1 non-Google single

Census vintage — the last A1 slice; reuses the resilient + observable pattern.
