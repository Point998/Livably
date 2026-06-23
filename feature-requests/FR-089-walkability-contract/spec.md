# FR-089 — Walkability chapter → headless report contract (rollout #10, counts-only)

**Status:** Spec · **Module:** `src/modules/walkability/{data,contract}.js` + wiring in `reportBuilder.js`
**Origin:** contract rollout (FR-078); design decision by Nathan (2026-06-23) · **Schema:** no change (1.0)

## Problem / goal

Migrate the **walkability** chapter to the contract. Walkability uniquely emits a **0–100 composite
`score` + graded category** (Walker's Paradise / …) — a numerical quality rating CONSTRAINT-001 forbids,
and the contract schema has no `score` field. **Decision (Nathan): surface only the underlying destination
counts as factual measures; drop the composite score and category.** Added additively as
`contract.chapters.walkability`. **10 of 14 chapters** after this.

## Approach

1. **Data-layer (additive):** the walkability output retains only up to 2 sample `destinations` per
   category — the true per-category counts are lost. Add a `counts` map `{ [label]: number }` to the
   Google and OSM walkability outputs (the count already exists mid-computation as `places.length` /
   `group.length`). **Keep `score`/`category`** so the SSR template is untouched; the contract reads
   `counts`, never `score`.
2. **Contract:** emit one factual finding per walkable category present (count > 0). No score, no grade.

## Inputs

`buildWalkabilityContract(walkability, opts)` where `walkability` (or `null`) =
`{ score, category, destinations, counts, isProxy, source }`:
- `counts`: `{ Grocery, Dining, Transit, Park, Pharmacy }` → integer (absent/0 when none). Added in this FR.
- `destinations`: `[{ label, icon, name, distanceMiles, walkMinutes }]` (nearest-first; used for copy only).
- `source`: `'google' | 'osm' | 'unavailable'`.
- `opts = { asOf?, degraded? }`. Returns `null` when `walkability` is absent.

**The `score` and `category` fields are deliberately NOT read** (CONSTRAINT-001).

## Findings produced

- **`walkable-{category}`** (one per WALK_TYPE with `counts[label] > 0`), bucket `cool`, tone `favorable`:
  - `claim.subject` e.g. 'Grocery within walking distance', measure `{ value: count, unit:
    'places_within_walk' }`, `comparison: null`.
  - provenance: `source==='osm'` → `{source:'OpenStreetMap', modeled:true}` (straight-line radius);
    else `{source:'Google Places', modeled:false}`.
  - `defaultCopy`: nearest place of that category + its walk minutes (from `destinations`), when available.
- **`walkability-pointer`** (bucket `check`, tone `neutral`) — emitted **only when no `walkable-*` finding
  was produced** (all counts 0, or `source==='unavailable'`): no measure; `fallbackAction` = url to Walk
  Score (`https://www.walkscore.com/`); `defaultCopy` notes few everyday destinations are within walking
  distance — verify walk routes/Walk Score directly. CONSTRAINT-015 (mirrors the template's FR-067 pointer).

## Edge cases & constraints

- **CONSTRAINT-001/008:** the composite `score` and graded `category` are never emitted; counts are factual
  measures. `.strict()` rejects a stray `score`/`category`/`color`. A test asserts no `"score"`/`"category"`
  in the serialized contract.
- **CONSTRAINT-015:** a car-dependent or data-unavailable address still gets the actionable Walk Score pointer.
- Honest provenance: Google counts `modeled:false`; OSM counts are real counts within a straight-line
  radius → `modeled:true`.

## Acceptance criteria

- AC-1 (data): walkability Google/OSM output includes `counts` keyed by WALK_TYPE label; existing data
  tests stay green.
- AC-2: full input → schema-valid, `chapterId:'walkability'`, `schemaVersion:'1.0'`.
- AC-3: a category with count>0 → `walkable-{category}` cool/favorable finding with
  `{value: count, unit:'places_within_walk'}`.
- AC-4: a category with count 0/absent → no finding for it.
- AC-5: nearest destination of a category → its name + walk minutes in `defaultCopy`.
- AC-6: no walkable destinations (all 0) OR `source:'unavailable'` → single `walkability-pointer` (check)
  with Walk Score url fallback; no `walkable-*` findings.
- AC-7: **no `score`/`category`/`color`/`grade` anywhere** in the serialized contract (CONSTRAINT-001/008).
- AC-8: `walkability` absent → `null`.
- AC-9: OSM source → provenance `modeled:true`, source `OpenStreetMap`.
- AC-10: per-address snapshots incl. **Jeffersonville IN**, an urban (many walkable), a car-dependent (pointer).
- AC-11: wired additively into `reportBuilder` as `chapters.walkability`; full suite green incl. 5 addresses.

## Notes

- `defaultCopy` transitional (FR-078 AC-9). `score`/`category` remain in the data output for the SSR
  template only — they never enter the contract.
