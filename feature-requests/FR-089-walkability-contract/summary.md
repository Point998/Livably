# FR-089 — Walkability chapter → headless report contract (rollout #10, counts-only) · Summary

**Status:** Complete · **Branch:** `FR-089-walkability-contract` · **Date:** 2026-06-23 · **Schema:** unchanged (1.0)
Migrates walkability to the contract — **10 of 14 chapters**. Resolves the CONSTRAINT-001 score conflict
flagged in FR-088 per **Nathan's decision: surface destination counts only, drop the composite score.**

## What shipped

- **Data-layer (additive) — `src/modules/walkability/data.js`:** both the Google and OSM paths now expose a
  `counts` map `{ Grocery, Dining, Transit, Park, Pharmacy }` (the true per-category count, which existed
  mid-computation but was previously discarded — only ≤2 sample destinations were kept). **`score`/`category`
  are retained** for the SSR template; the contract reads `counts`, never `score`.
- **`src/modules/walkability/contract.js` (new) — `buildWalkabilityContract(walkability, opts)`:**
  - One **`walkable-{category}`** finding per category with `count > 0` (bucket `cool`, tone `favorable`):
    measure `{value: count, unit:'places_within_walk'}`; `defaultCopy` = nearest place + walk minutes
    (from `destinations`). Categories with 0/absent count are omitted.
  - **`walkability-pointer`** (check, neutral) — emitted **only** when no category has a walkable
    destination (car-dependent) or `source:'unavailable'`: Walk Score url fallback (CONSTRAINT-015 floor,
    mirrors the template's FR-067 pointer). No composite rating.
  - Provenance: Google `modeled:false`; OSM `modeled:true` (straight-line radius).
- **`src/services/reportBuilder.js`:** `contract.chapters.walkability` wired additively.

## The CONSTRAINT-001 resolution

The composite `score` and graded `category` are **never read or emitted** by the contract — a test asserts
the serialized output contains no `"score"`/`"category"`/`"color"`/`"grade"`, and the schema's `.strict()`
would reject them structurally. The walkability signal survives as **factual counts** ("3 grocery options
within walking distance, nearest a 4-min walk") rather than a banned 0–100 quality rating.

## Tests (+15, +3 snapshots) — full suite **99 suites / 1814 tests green** (was 98/1800)

- `tests/modules/walkability/data.test.js` (+2): Google + OSM `counts` map exposed.
- `tests/modules/walkability/contract.test.js` (new, 13): schema-valid; per-category count findings;
  count-0 omitted; nearest→defaultCopy; car-dependent/unavailable → Walk Score pointer; **no score/category
  leak**; OSM modeled:true; per-address snapshots (urban, car-dependent pointer, **Jeffersonville IN** OSM).

## Notes / follow-on

- **10 of 14 chapters on the contract.** Remaining: environment, growth, garden, climate, costs (and the
  composite "demographics/community" already done). Recommended next: **environment** (FEMA flood zone + EPA
  air — factual/categorical, good `comparison{}` use). Multi-source `climate` last.
- `defaultCopy` transitional (FR-078 AC-9). `score`/`category` remain in the data output for the SSR template.
