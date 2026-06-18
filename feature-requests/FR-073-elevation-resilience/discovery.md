# FR-073 — USGS elevation resilience (non-Google single) — Discovery

## Phase 1 — Discovery (read-only)

### What this slice is
The 2nd A1 **non-Google single** (after FR-072 soil). USGS elevation is a lone
third-party API (USGS EPQS — The National Map elevation point query service) with
no fallback. Unlike soil, the spike found a **real, verified, like-for-like
independent fallback** — so this slice gets an actual second data source, not just
a hardened primary.

### How elevation works today (verified) — TWO consumers, one endpoint
Both hit `USGS_ELEVATION_URL` = `https://epqs.nationalmap.gov/v1/json`:

1. **Climate** — `getWatershedContext(lat, lng)` (`climate/data.js:329`) queries
   **5 points** (center + 4 offsets) via `fetchElevationWithRetry(url, 2)`
   (`:238` — 2 retries, 5 s timeout, 1 s backoff), classifies topographic position,
   fills failed surrounding points with the center value, returns `null` if the
   center point fails. Exhaustion is logged via `logError` — **but NOT recorded in
   the FR-068 ledger**. SOURCES descriptor `usgs-elevation` runs `getWatershedContext`.
2. **Garden** — `getMicroclimateData(lat, lng)` (`garden/data.js:94`) queries **1
   point** in a bare `try/catch` → `elevationFt` stays `null` on failure, **fully
   silent** (no retry, no `logError`, no ledger). SOURCES descriptor
   `usgs-elevation-garden` runs `getMicroclimateData`.

**The retry machinery in climate is itself evidence EPQS is flaky** — it's a known
unreliable/slow endpoint, which is exactly why a real fallback matters here.

### Three problems with today's path
1. **No fallback** — EPQS down = climate loses topographic position, garden loses
   the elevation note. A single point of failure for both chapters.
2. **Observability gap** — climate logs exhaustion to `logError` but **not** the
   FR-068 ledger; garden swallows *totally silently*. Neither degradation is
   visible in the ledger/admin panel (the NR-004 swallow class, again).
3. **Duplication** — two modules independently fetch the same endpoint with the
   same single-point query shape.

### Verified independent fallback (live-probed) — a real second source this time
| Candidate | Result (Georgetown KY) | Verdict |
|---|---|---|
| **USGS EPQS** (current) | ✅ 200 — `value: 850.5 ft` | Authoritative primary. Flaky (hence the retry). |
| **OpenTopoData `ned10m`** (`api.opentopodata.org`) | ✅ 200 — `258.60 m` ≈ **848 ft** (matches EPQS's 850!) | **Independent host serving the same USGS NED 10 m DEM** — genuine like-for-like. Returns **meters** (×3.28084). Supports **batch** (`locations=a,b|c,d|…`) → climate's 5 points in **one** call. Public limit ~1 call/s, 1000/day, 100 loc/call. |
| **Open-Elevation** (`api.open-elevation.com`) | ✅ 200 | Backup-of-backup (SRTM-based; flakier). Keep in reserve, not primary fallback. |

Unlike FR-072 soil (no independent source existed → hardened-primary + floor),
elevation **has** a clean independent fallback. So FR-073 = **EPQS primary →
OpenTopoData `ned10m` fallback → honest absence**, observable via `sourceChain`.

### Floor: honest absence, no "actionable" link needed
Both templates already degrade by *omission*, not breakage:
- Climate `buildTopographicPositionHTML`: `if (!watershed) return ''` — narrative
  simply doesn't render.
- Garden `buildMicroclimateHTML`: `elevNote = elevationFt !== null ? '…' : ''` —
  note omitted; solar angles still render.

Unlike soil (where a SoilWeb deep-link made the floor actionable), there is **no
meaningful buyer action** for missing ground elevation, so the honest floor is
absence. CONSTRAINT-015 is already satisfied — no floor work required.

### Recommended shape — a shared, observable elevation helper
New **`src/shared/elevation.js`** (joins the `shared/` data-utility family —
`overpass.js`, `osmPlaces.js`, `census.js`, `sourceChain.js`), so both consumers
de-dup onto one resilient, observable fetch:

- `fetchElevationsFeet(points)` — batch form. `sourceChain([
  { name:'epqs', run: query each point via EPQS-with-retry, isValid: center
  present }, { name:'opentopo', run: one batched ned10m call (m→ft),
  isValid: center present } ], …, { label:'elevation' })`. Returns an array of feet
  (null per missing point) or null. FR-068 ledger records the EPQS→OpenTopoData
  fallback + full exhaustion for free.
- `fetchElevationFeet(lat, lng)` = `fetchElevationsFeet([[lat,lng]])[0]`.
- Unit handling (EPQS `units=Feet`; OpenTopoData meters→feet) lives in the helper.

Then:
- `getWatershedContext` swaps its inline `fetchElevationWithRetry` loop for
  `fetchElevationsFeet(the 5 points)`, **keeping** the fill-missing-with-center +
  `classifyTopographicPosition` logic unchanged.
- `getMicroclimateData` swaps its `try/catch` for `fetchElevationFeet(lat,lng)`.
- SOURCES descriptors point at the EPQS-specific path (monitor reports on EPQS),
  optionally add an `opentopo-elevation` fallback descriptor.

### Decisions for the spec
1. **Shared helper vs per-module** — recommend the **shared helper** (de-dup, one
   observability label, matches the `shared/` pattern + Nathan's
   architecture/scalability priority). Per-module is smaller but duplicates the
   fallback + gives two ledger labels.
2. **Fallback dataset** — `ned10m` (USGS NED 10 m, CONUS+). Fine — Livably is a US
   product, all 5 test addresses are US. (Global `srtm30m` only if a non-CONUS
   address ever appears; out of scope.)
3. **Rate limit** — OpenTopoData public ~1 call/s; batch keeps climate to **1**
   call, garden to 1. Acceptable now; a self-host is a Hardening-scale concern, not
   this slice.

### Blast radius (existing tests to preserve/migrate)
- `tests/modules/climate/data.test.js` — `fetchElevationWithRetry` (6 tests) +
  `getWatershedContext` (exhaustion-logging asserts). If `fetchElevationWithRetry`
  moves into the shared helper, either keep a thin re-export or migrate these tests
  to `tests/shared/elevation.test.js`.
- `tests/modules/garden/data.test.js` — `getMicroclimateData` (success/fail/null/
  -9999 sentinel, 7 tests) — must keep passing through the new helper.
- `tests/chapters/climate-data.test.js` — references EPQS failure → null path.

### Risks / unknowns
1. **Preserve climate semantics** — fill-missing-surrounding-with-center +
   `classifyTopographicPosition` must be byte-identical; only the fetch mechanism
   changes. The `-9999`/`> -1000` no-data guards (garden) and `null`-value guard
   (climate) must survive into the helper.
2. **OpenTopoData latency/limits** — bound timeouts; the public instance can be
   slow under load. Batch + tight timeout mitigates.
3. **ned10m coverage gaps** (far offshore / non-CONUS) → null, handled by absence.
4. **Test migration** — the `fetchElevationWithRetry` rename/move is the main
   churn; plan it explicitly.

### Recommendation
Proceed to Phase 2 (spec) as **FR-073-elevation-resilience**: a shared
`src/shared/elevation.js` (EPQS → OpenTopoData `ned10m` → null, observable via
`sourceChain`/FR-068), consumed by both Climate (batch-5) and Garden (single),
preserving all existing topographic/microclimate logic. Honest-absence floor (no
link). This is a *stronger* slice than soil — a verified independent fallback plus
the observability + de-dup wins.
