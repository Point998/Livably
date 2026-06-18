# FR-072 — USDA soil resilience (non-Google single) — Specification

*Phase 2. Module: `property` (soil is fetched here; Garden consumes the same
object). Shape settled by the SoilWeb spike (see discovery): **hardened SDA
primary → observable, coordinate-specific actionable floor** via `sourceChain`. No
fabricated second source — the spike confirmed none exists as a public JSON API.*

## Goal

Turn the lone USDA SDA soil fetch from a **silent single point of failure** into a
resilient, observable one:
1. **Resilience** — a bounded retry survives the real failure mode (transient
   timeout/5xx of a single host).
2. **Observability** — the failure is recorded in the FR-068 degradation ledger
   instead of being swallowed to `null` (the NR-004 swallow debt).
3. **Honest, actionable floor** — when soil is genuinely unavailable, the template
   links a **coordinate-specific** SoilWeb AOI instead of a homepage.

No change to the `soil` object's contract (still `{…}`-or-`null`), so the many
existing `!soil` degradation paths across Property + Garden stay untouched
(CONSTRAINT-015 already satisfied; we only improve the link).

## Design — `src/modules/property/data.js`

### `getSoilDataSDA(lat, lng)` (renamed from today's `getSoilData` body)
- Same SSURGO query against the SDA Tabular REST.
- **Distinguish empty from failed** (today both collapse to `null`):
  - `!resp.ok` → **throw** `Error('SDA HTTP <status>')` (transient/failure).
  - parsed `Table` empty/absent → **return `null`** (legitimate: point not mapped /
    open water / urban pits → preserves the existing urban-land narrative).
  - rows present → return the soil object (unchanged fields).
- **Bounded retry:** wrap the fetch in a single retry on a *transient* throw
  (timeout / network / 5xx — not 4xx). Second attempt uses a tighter timeout
  (10 s) to bound total latency (≤ ~25 s worst case; runs inside the existing
  `Promise.allSettled`, so it doesn't block sibling property data). After the retry
  still failing → throw.

### `getSoilData(lat, lng)` (public — contract unchanged: object-or-null)
```
const picked = await sourceChain(
  [{ name: 'sda', run: () => getSoilDataSDA(lat, lng), isValid: isValidSoilOrEmpty }],
  null,
  { label: 'property-soil', log: chainLog('getSoilData', `${lat},${lng}`) },
);
return picked ? picked.value : null;   // null only when SDA threw on both tries
```
- `isValidSoilOrEmpty = (r) => r === null || (r && typeof r.drainagecl === 'string')`
  — a soil object **and** a legit-empty `null` are both valid SDA outcomes; only a
  *thrown* error is a miss. So an empty/urban point short-circuits as success (no
  false degradation event); a real outage throws → chain records `error` +
  `exhausted` in the FR-068 ledger → `getSoilData` returns `null`, exactly as
  today, but now **observable**.
- Add the `chainLog(fn, origin)` adapter (FR-070/071 form) to this file.

### `getPropertyIntelligence(...)` — add the coordinate floor link
- Compute `soilwebUrl = 'https://casoilresource.lawr.ucdavis.edu/gmap/?loc=' +
  lat + ',' + lng` (always — it's just a deep-link, no fetch).
- Return it alongside soil: `{ soil, soilwebUrl, era, housingAgeBands, locationInfo }`.

### SOURCES
- Repoint `usda-soil.run` → `getSoilDataSDA` (reports SDA specifically, like the
  Google-impl descriptors). `isValid: (r) => r === null || typeof r?.drainagecl ===
  'string'` (accept legit-empty so unmapped points aren't false-flagged red; the
  *throw* on real failure is what the monitor catches).

### Exports
Add `getSoilDataSDA`; keep `getSoilData`.

## Template — `src/modules/property/template.js` (link upgrade only)

The coordinate floor link is **Property-only** (where the soil-source link lives).
Garden's soil floor is narrative-only and stays unchanged.

- `buildSoilTab(soil)` → `buildSoilTab(soil, soilwebUrl)`: in the `!soil` branch,
  append a point-specific link — e.g. *"Look up this exact location in the
  [USDA/UC-Davis SoilWeb survey](soilwebUrl)."* — alongside the existing
  geotech/seller prompt. Caller (`buildPropertyResearchTab`/tab list) passes
  `propIntel.soilwebUrl`.
- Research tab `soilSection`: the existing `Full soil data` link → use
  `soilwebUrl` when present (point-specific) instead of the WSS homepage. Keep the
  WSS homepage as a secondary "browse all" link if desired.
- `buildPropertyIntelligenceHTML` soil `!soil` narrative is unchanged text; no link
  there today, leave as is (the tab + research links carry the floor link).
- No CSS/class changes (CONSTRAINT-008); no fetch in template (CONSTRAINT-009).

## Edge cases

| Case | Expected |
|---|---|
| SDA up, soil mapped | byte-identical to today; no retry; `soil` object |
| SDA up, point unmapped (empty Table) | `null` short-circuits as valid; **no retry, no degradation event**; urban-land narrative |
| SDA transient fail then success | retry succeeds; soil object; (optional) ledger notes the first miss |
| SDA down both tries | throw → chain `error`+`exhausted` recorded in FR-068 ledger → `getSoilData` returns `null` → floor with **coordinate SoilWeb link** |
| 4xx (bad query) | no retry (not transient) → throw → floor |

## Acceptance criteria

1. SDA success (mapped) → unchanged `soil` object; no extra latency on the happy
   path (no retry fired).
2. Legit-empty point → `null`, **no retry, no degradation event** (urban-land
   narrative preserved).
3. SDA failure → `getSoilData` returns `null` **and** a degradation event is
   recorded in the FR-068 ledger (assert via `getLedger()`/`runWithLedger`).
4. Transient-then-success → one retry, returns the soil object.
5. Floor renders a **coordinate-specific** SoilWeb link (`/gmap/?loc=lat,lng`) in
   Property's soil tab + research tab; Garden floor unchanged.
6. `soil` contract unchanged (object-or-null) — no other Property/Garden soil
   branch touched.
7. No scoring, no fabricated soil values (CONSTRAINT-001, honest-provenance);
   reuses `sourceChain` (CONSTRAINT-014); classes/HTML rules respected (008/009).
8. Tests cover: SDA success, empty→null (no event), failure→null+ledger event,
   retry-then-success, no-retry-on-4xx, `soilwebUrl` shape, template floor link.
   **Jeffersonville IN** in the live 5-address check. All suites green.

## Out of scope / deferred
- A true independent JSON secondary — the spike proved none is publicly available;
  revisit only if SoilWeb publishes a documented lat/lng JSON API.
- ISRIC SoilGrids modeled-texture proxy — rejected for now (different fields,
  rate-limited, null-on-probe); would be a separate FR if ever wanted.
- The same hardening for the *other* non-Google singles (USGS elevation, Census
  vintage) — separate slices; this establishes the pattern for them.
