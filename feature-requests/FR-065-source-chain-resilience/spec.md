# FR-065 — Source-chain resilience primitive (NOAA climate normals, first slice)

*Track A1 (NR-004 / roadmap). Extends the FR-060 pattern from one module to a **reusable primitive**, then proves it on the postmortem-backed NOAA path. Phases 1–3 of the workflow precede this; see `discovery.md`.*

## Problem

FR-060 proved a resilience pattern (primary → fallback → graceful link) but **hard-coded it inside Utilities**. Eleven other single-source modules (see `discovery.md`) still have only the CONSTRAINT-015 link floor — no real second data source. Re-implementing the chain per module would violate CONSTRAINT-014 (cross-cutting coherence lives in `shared/`) and CONSTRAINT-013 (no ad-hoc copies). We need the pattern as **one reusable primitive**, proven on the highest-value first case: **NOAA climate normals** — the only single-source path with its own postmortem (PM-004), free to fall back, and isolated from the Google/safety constraints.

## Solution (two parts)

1. **A reusable `sourceChain` primitive** in `src/shared/` — runs an ordered list of async source fns, returns the **first result that passes a validity predicate**, tags it with provenance, and **logs which tier fired** (pays down a slice of the NR-004 observability debt: swallowed `null`s become visible). Pure orchestration; no IO of its own.
2. **Apply it to climate normals:** NOAA CDO station normals (primary, authoritative) → modeled monthly climatology fallback (gap-free, keyless) → `null` (existing link fallback, unchanged). The fallback returns the **same contract** the NOAA path returns, so logic/template change only to render a subtle provenance note.

## Shared layer — `src/shared/sourceChain.js` (NEW)

```
sourceChain(sources, ctx, { label }) -> Promise<{ value, source } | null>
```
- `sources`: ordered array of `{ name, run(ctx), isValid(result) }`. `run` is the existing per-source fetcher; `isValid` defaults to `(r) => r != null`.
- Tries each in order; on the first `isValid` result returns `{ value, source: name }`. On invalid/throw, logs (via existing `logger`) `chain <label>: <name> miss/error` and continues. All exhausted → returns `null`.
- **No rettry/backoff here** (that already lives in `rateLimit.js` for Google; non-Google fetchers own their own timeouts). The chain is *ordering + provenance + observability* only.
- Pure: no `fetch`, no cache, no env reads. Lives in `shared/` per CONSTRAINT-014; reusable by every future A1 slice (incl. the later Google-POI cost-resilience slice).

## Data layer — `src/modules/climate/data.js`

- Rename the existing NOAA body to **`getNormalsFromNOAA(lat, lng)`** — unchanged behavior; still returns `{ monthly, annual, stationId, stationName } | null` (now conceptually tagged `source: 'NOAA'` by the chain).
- Add **`getNormalsFromModel(lat, lng)`** — a keyless modeled-climatology fallback (**candidate: Open-Meteo Climate API; exact endpoint + that modeled normals are an acceptable stand-in for station normals to be confirmed in Phase 3 planning**). Must return the **identical contract**:
  - `monthly`: 12 rows `{ month, tMaxF, tMinF, precipIn, snowIn }` (derive monthly means from the modeled series; `snowIn` may be `null` if unavailable — acceptable, it is already nullable).
  - `annual`: `{ daysAbove90, daysAbove95, daysBelow32 }` best-effort (`null`s allowed — already optional on the NOAA path).
  - `stationName`: a human label for the modeled source (e.g. `"Modeled climatology (Open-Meteo)"`); `stationId: null`.
  - Returns `null` on any failure (→ link floor).
- Replace the direct NOAA call site with the chain:
  `sourceChain([{ name:'NOAA', run:()=>getNormalsFromNOAA(lat,lng), isValid: r => Array.isArray(r?.monthly) && r.monthly.some(m=>m.tMaxF!=null) }, { name:'model', run:()=>getNormalsFromModel(lat,lng), isValid: r => Array.isArray(r?.monthly) && r.monthly.some(m=>m.tMaxF!=null) }], …, { label:'climate-normals' })`
  → unwrap to `{ ...value, normalsSource: source }` (or `null`).
- **Cost rules (FR-058):** fallback is free/keyless; it adds **no Google call**. (Normals are not cell-cached today; cell-caching the normals result is an *optional* consistency nicety flagged in Open Questions, not required for this slice.)

## Logic layer — `src/modules/climate/logic.js`

- Thread `normalsSource` through to the assembled climate object (e.g. `normalsSource: raw.normals?.normalsSource ?? null`). **No business-rule change** — the monthly/annual shape is identical, so all existing normals logic (rarity statements, etc.) works unchanged.

## Template layer — `src/modules/climate/template.js`

- When `normalsSource && normalsSource !== 'NOAA'`, append a provenance line in the normals section. **Tone: honest provenance, not apology** (see Design principle below) — frame it as "this is the best regionally-available signal," not "sorry, the good data is missing." Working draft:
  `<p class="prem-disclaimer">Regional modeled climate normals (Open-Meteo) — no NOAA weather station has records near this address, so this reflects the wider area rather than a station reading.</p>`
- NOAA path unchanged. No inline styles (CONSTRAINT-008); no scoring (CONSTRAINT-001).

### Design principle — honest provenance (Nathan, 2026-06-16)
At the scale of data Livably pulls, modeled/regional sources won't always match a measured station for proximity or historical tracking — especially in **rural areas**. The product stance: **surface the best regionally-available signal *with* a plain-language callout of what it is.** This shows we bring in every relevant signal we can *and* are realistic with the buyer about what exists — Livably reports data, it does not invent precision it doesn't have. Every fallback rendered through this primitive must therefore (a) label its source plainly and (b) state the limitation in buyer-readable terms (regional vs. parcel/station, modeled vs. measured). This generalizes FR-060's "via HIFLD" note into a stated principle for all of A1.

## Constants / config

- New base URL(s) for the modeled source in `constants.js` (no hard-coded URLs in `data.js`).
- Keyless — **no new `.env` entry** expected (confirm in planning). If the chosen source needs a key, it must degrade to the link floor when unset (FR-060 precedent).

## SOURCES descriptor (FR-063)

- Add a `{ id:'openmeteo-normals-fallback', provider:'open-meteo', coverage:'all', run, isValid }` descriptor to climate's `SOURCES` so the harness verifies the fallback against the 5 addresses too.

## Constraints

- **CONSTRAINT-014:** the chain primitive lives in `shared/`, not per-module.
- **CONSTRAINT-013:** reusable primitive, not a copy of FR-060's inline logic.
- **CONSTRAINT-015:** NOAA → modeled → link; never silent.
- **CONSTRAINT-016:** keep the existing NOAA record-content validation (the `isValid` predicate enforces real `tMaxF`, not just a non-null object).
- **CONSTRAINT-001 / 008 / 009 / 011:** no scoring; no inline styles; data fetches / logic categorizes / template renders; tests + fixtures, all 5 addresses.
- **Cost (FR-058):** free/keyless fallback; no new Google call; rides existing cache behavior, no regression.

## Tests

- `sourceChain` unit tests: returns first valid + correct `source`; skips invalid/throwing sources and logs; returns `null` when all fail; respects a custom `isValid`.
- `getNormalsFromModel` parser fixture (`tests/modules/climate/fixtures/openmeteo-normals.json`) → 12 monthly rows, correct unit conversions, nullable `snowIn`/`annual`.
- Climate integration: NOAA success → `normalsSource:'NOAA'` and **no model call**; NOAA `null`/invalid → model fills in, `normalsSource:'model'`; both fail → `null` (link floor).
- 5 test addresses resolve a non-null normals band (real or modeled); Louisville KY (the PM-004 address) specifically exercised.
- Full suite green; existing climate tests unchanged.

## Acceptance Criteria

- [ ] `src/shared/sourceChain.js` exists, is pure, unit-tested, and used by climate normals.
- [ ] NOAA remains primary and authoritative; no model call when NOAA returns valid records.
- [ ] When NOAA yields no valid station, the modeled fallback returns the **same contract** and the section renders with a "modeled" provenance note.
- [ ] Both-fail still degrades to the existing CONSTRAINT-015 link floor.
- [ ] No new Google call; no scoring; no inline styles; fixtures committed; full suite green.
- [ ] climate `SOURCES` gains the fallback descriptor so FR-063 verifies it.

## Out of scope (YAGNI) / future slices

- Applying the primitive to **other modules** — USDA soil, USGS elevation, Census vintage — each its own follow-up FR reusing this primitive.
- The **Google-POI cost-resilience fallback** (OSM Overpass for *non-safety* POIs only; never the CONSTRAINT-003 safety tier) — its own FR; this is the slice that addresses the Google cost-resilience concern, and it reuses `sourceChain` unchanged.
- A hard spend cap / durable cross-instance usage accounting — that's NR-004 Hardening Stage 1, not A1.

## Open questions (resolve in Phase 3 planning)

1. ✅ **RESOLVED (Nathan, 2026-06-16):** labeled modeled/regional climatology is an accepted stand-in — honest provenance over a blank section. See "Design principle — honest provenance." Remaining planning task is purely mechanical: confirm the modeled source + endpoint (Open-Meteo Climate API vs alternative) and its published period for an honest period label.
2. **Cell-caching the normals result** (and the fallback) for consistency with FR-058 — optional nicety; include only if cheap.
3. **Unit/period alignment** between NOAA's 2010-normals records and the modeled series (NOAA path currently queries the 2010 normals; confirm the fallback's period is labeled honestly).
