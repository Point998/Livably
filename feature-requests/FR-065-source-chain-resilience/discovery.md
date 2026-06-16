# FR-065 — Discovery (Phase 1, read-only)

*Track A1: extend the FR-060 resilience pattern beyond Utilities. Discovery completed 2026-06-16. No code changed in this phase.*

## What already exists

- **The FR-060 pattern** is live in exactly one module (Utilities): primary → fallback (different provider) → graceful link. `NREL → HIFLD` (electric), `NREL → OpenChargeMap` (EV). Each result carries a `source` tag for provenance; the template renders a "fallback fired" note.
- **CONSTRAINT-015 (graceful degradation) is the universal floor already** — every module degrades to a named link / phone / instruction when its source dies. So A1 is **not** "stop the crash." It is "**insert a real second data source before the link fallback**" for modules that have none today.
- **FR-063's `SOURCES` descriptors** (41 across 14 modules) are a ready-made dependency map *and* a ready-made way to measure each new fallback against the 5 test addresses.

## Dependency inventory

### Already multi-tiered (leave alone)
| Module | Chain |
|--------|-------|
| Utilities | NREL→HIFLD; NREL→OpenChargeMap (FR-060) |
| Climate (storm events) | NOAA CDO → pre-cached JSON → link (3-tier) |
| Sensory (road noise) | BTS → OSM fallback |

### Single-source — the A1 candidates
| Provider | Modules | Second source exists? |
|----------|---------|------------------------|
| **NOAA** (climate normals) | Climate | Yes (modeled climatology, e.g. Open-Meteo). **Has a postmortem (PM-004).** |
| **USDA soil** | Property | Likely (SoilGrids/ISRIC) — validate |
| **USGS** elevation/watershed/seismic | Climate, Garden | Elevation has alts; watershed/seismic are USGS-specific |
| **Census ACS** | Community, Property, Growth, Sensory | Reliable; fallback = cached prior vintage |
| **FEMA** | Climate (declarations), Sensory (flood NFHL) | NFHL flood is authoritative / hard to replace |
| niche single-API | AirNow, EPA, CMS, NPI, PHZM, iNaturalist | Case-by-case |

## The systemic finding — Google

~9 modules lean on Google Places / Distance Matrix (reachability, health, schools, safety, walkability, recreation, access, growth, sensory-airports). Google is the dominant single point of failure **and** the deliberate source of truth (rural POI accuracy = the differentiation). Safety-critical paths are bound by CONSTRAINT-003 (drive-time verification) and CONSTRAINT-006 (cross-state). A Google fallback is therefore the highest blast-radius *and* the most sensitive — it belongs in its own later FR, not this slice.

## Cost posture (verified in code, 2026-06-16)

The NR-002/NR-003/FR-058 cost discipline is structurally intact:
- H3 cell-sharing live across the 4 Google-heavy modules (`spatial.js`; 31 cell-aware call-sites).
- Long-TTL layered caches (`cache.js`): geocode 90d, places 7d, drivetime 24h, drivetime_cell 14d, utilities 30d, watershed/seismic 90d, rates ≤180d.
- All Google calls funnel through one proxy (`client.js` → `rateLimit.js`): concurrency cap, retry/backoff, **quota-exhaustion detection** (`QuotaExceededError`), rolling 24h usage log (`/admin/api-usage`).
- **Gaps (pre-existing, = NR-004 Stage 1):** `usageLog` in-memory + cache disk-backed (single-instance); no hard spend cap (only graceful quota handling + the FR-064 request throttle).

**Implication for A1:** non-Google fallbacks have zero Google-cost impact; a Google fallback (later FR) is a *cost-resilience* win — it keeps the report alive when quota/spend trips.

## Risks / constraints that bound the design

- **CONSTRAINT-014:** cross-cutting resilience logic must live in `shared/`, not be reimplemented per module.
- **CONSTRAINT-003 / 006:** never fallback the safety/jurisdiction tier carelessly.
- **Fallback ≠ silent quality drop:** lower-fidelity fallbacks must be *labeled* (FR-060 precedent) and *logged* (NR-004 observability thread — swallowed `null`s hid the FCC 405).
- **Cost:** any fallback must prefer free/keyless sources, ride the existing cell cache, and never add an uncached per-address Google call.

## Recommended scope (carried into Phase 2)

Do **not** spec all of A1 at once (anti-mega-FR; CONSTRAINT-013). FR-065 = **build a reusable `sourceChain` primitive in `shared/` + prove it on NOAA climate normals** (postmortem-backed, free, isolated from Google/safety). Every later slice — including the Google-POI cost-resilience fallback — is then a cheap *application* of the same primitive. Ordering after this: USDA soil → USGS elevation → (separate FR) Google-POI cost-resilience.
