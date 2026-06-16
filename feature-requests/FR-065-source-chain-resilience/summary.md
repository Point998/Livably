# FR-065 — Summary

*Track A1 (NR-004): generalize the FR-060 resilience pattern into a reusable primitive, proven on the postmortem-backed NOAA climate-normals path. Built test-first (TDD). Phases 1–3 in `discovery.md` / `spec.md` / `implementation-plan.md`.*

## What shipped

1. **`src/shared/sourceChain.js`** — a reusable, pure source-chain primitive. Runs an ordered list of sources, returns the first result passing a validity predicate (tagged with provenance `source`), and logs each miss/error so a silent fallthrough is visible (pays down a slice of NR-004's observability debt). Generalizes FR-060's inline NREL→HIFLD logic so every future A1 slice reuses one mechanism (CONSTRAINT-014). No fetch / cache / env — fully unit-tested.

2. **Climate normals fallback** (`src/modules/climate/data.js`):
   - `aggregateOpenMeteoNormals(daily)` — pure transform: an ERA5 daily series → the exact NOAA normals contract. **Critical guard:** Open-Meteo returns °F/inch already, so it must NOT apply NOAA's tenths/hundredths division — isolated as its own fixture-tested function specifically to prevent that.
   - `getNormalsFromModel(lat,lng)` — keyless Open-Meteo ERA5 archive fetch (1991–2020) + aggregate; `null` on any failure.
   - `getClimateNormals(lat,lng)` — the chain: **NOAA station normals (authoritative) → Open-Meteo modeled climatology (regional, keyless) → null (link floor)**. The validity predicate enforces real temperature records on *both* tiers (CONSTRAINT-016).
   - New `SOURCES` descriptor for the fallback so FR-063's scheduled monitor verifies it.

3. **Honest provenance** (`src/modules/climate/template.js`) — per the design principle Nathan set (2026-06-16): when normals come from the model, the report says so plainly and confidently ("Regional modeled climate normals (Open-Meteo) — no NOAA weather station has records near this address…"), and **every** normals source line (Winter / Heat / Calendar / Research tabs) now cites the actual source instead of hardcoding "NOAA Climate Normals." Surfaces the best regional signal *with* a callout — Livably reports data, it doesn't manufacture precision.

Logic layer: **no change needed** — `normalsSource` rides on the `climateNormals` object straight from data to template.

## Verification

- **Full suite green: 1,493 tests** (was 1,470; +23 — 8 sourceChain, 12 normals-fallback, 3 template/regression). Built test-first: each test watched fail before implementation.
- **Live 5-address check of the fallback** (keyless, zero Google cost):
  | Address | Jan H/L | Jul H/L | days ≥90 | days ≤32 |
  |---------|---------|---------|----------|----------|
  | Georgetown KY | 41.4/26.9 | 85.3/68.2 | 15 | 79 |
  | Harlan KY | 45.6/30.2 | 83.8/68.5 | 7 | 59 |
  | **Louisville KY (PM-004)** | 41.5/26.9 | 86.7/69.5 | 23 | 78 |
  | Bozeman MT | 30.4/11.4 | 79.5/51.9 | 3 | 194 |
  | Jeffersonville IN | 41.5/26.7 | 86.7/69.4 | 22 | 78 |
  - Values are climatologically plausible (Bozeman's 194 sub-freezing days vs KY's ~78). **The PM-004 address — which used to render a blank normals section — now gets a regional modeled band with honest provenance.**

## Known limitation (captured, not blocking)

- **Open-Meteo free tier enforces a per-minute request limit.** Five back-to-back 30-year pulls (~1.3 MB each) trip HTTP 429; spaced requests all succeed. In production the fallback fires only on a NOAA miss (rare, rural), so organic traffic is unlikely to hit it — and a 429 **degrades gracefully** (returns null → chain → CONSTRAINT-015 link floor), never a crash. A bulk/B2B batch of rural addresses *could* hit it.
- **Recommended follow-up:** cell-cache the modeled normals result (FR-058 seam). Deliberately deferred to keep this slice tight, but the rate-limit finding strengthens the case — it would make repeat/bulk lookups in a cell free. The primary NOAA path is intentionally untouched.

## Constraints honored

CONSTRAINT-001 (no scoring), 008 (no inline styles — `prem-disclaimer` class), 009 (data fetches / template renders — `aggregateOpenMeteoNormals` returns data, zero HTML), 011 (tests + fixtures, all 5 addresses incl. Jeffersonville/Louisville), 014 (primitive lives in `shared/`), 015 (graceful floor preserved), 016 (record-content validity guard on both tiers).

## Out of scope (future A1 slices, reuse this primitive)

USDA soil, USGS elevation, Census vintage — each its own FR. The **Google-POI cost-resilience** fallback (OSM for non-safety POIs only) is the slice that addresses the Google cost-resilience concern; it reuses `sourceChain` unchanged.
