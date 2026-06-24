# FR-095 — Summary

**Status:** complete. Rollout #16 — **completes the headless-contract rollout 100%**
(every numbered chapter + climate + the deferred sensory ambiance items now serialize).

## What shipped

Three ambiance findings added to `buildEnvironmentContract` (`src/modules/sensory/contract.js`):

| Finding id | bucket | measure | tone rule | provenance |
|---|---|---|---|---|
| `airport-noise` | `consider` | `{value: miles, unit:'miles'}` / `null` | `<5` caution · `<15` neutral · `≥15`/none favorable | Google Places / OpenStreetMap (flips on `source`), `modeled:false` |
| `rail-proximity` | `consider` | `{value: miles, unit:'miles'}` / `null` | `<0.25` caution · `<0.75` neutral · `≥0.75`/none favorable | OpenStreetMap, `modeled:false` |
| `light-pollution` | `cool` | `{value: bortle, unit:'bortle_class'}` | `≤3` favorable · else neutral (never caution) | U.S. Census ACS / OpenStreetMap, **`modeled:true`** |

## Discipline held

- **No schema change** — `schemaVersion` stays `1.0` (additive findings only).
- **SSR `template.js` byte-unchanged**; `data.js` / `logic.js` / `reportBuilder.js` unchanged.
  Diff is `contract.js` + the test + its snapshot only (3 files).
- The FR-090 health/safety **null-guard is preserved** — ambiance rides along *after* it, so an
  ambiance-only input still returns `null` (AC-5; light pollution is always present, so this matters).
- **Confirmed "none in range" (null airport/rail) = a complete answer**, not missing data → `favorable`
  tone, **no `fallbackAction`** (the deliberate contrast with the health/safety `*-missing` findings).
- CONSTRAINT-001/008: Bortle/distance are external/factual measures (like AQI/DNL), tone derived from
  numbers; no `color`/`category`/`desc`/`bortle` structured keys leak (only inside `defaultCopy`).
  Note: `"label"` is a legitimate `FallbackActionSchema` key and is intentionally not in the leak assertion.

## Tests

- `tests/modules/sensory/contract.test.js` — TDD (RED→GREEN): distance-band tones, source flip,
  none-case (favorable + null measure + no fallback), light bucket/measure/modeled, never-caution,
  guard-preserved. Leak assertion extended to `desc`/`bortle`.
- Per-address snapshots updated with ambiance data across Georgetown / Harlan (rural null + dark sky) /
  **Jeffersonville** (CONSTRAINT-011).
- **Full suite: 105 suites / 1897 tests / 47 snapshots green.**

## Two pre-existing `// shortcut:`s (unchanged, noted in the session-10 hand-off)

Untouched here — collapse each when its SSR template is next edited for another reason:
- `costs/template.js` still computes carrying-cost math inline.
- `climate/template.js` still defines `getTornadoTier` inline.

## 4-phase workflow

All phases executed: Discovery (read-only summary) → spec.md → implementation-plan.md → TDD implementation.
No phases skipped.
