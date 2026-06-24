# FR-092 — Garden / "What Will Grow" chapter → headless report contract (rollout #13) · Summary

**Status:** Complete · **Branch:** `FR-092-garden-contract` · **Date:** 2026-06-23 · **Schema:** unchanged (1.0)
Migrates the garden / nature chapter to the contract — **13 of 14 chapters**.

## What shipped

- **`src/modules/garden/contract.js` (new) — `buildGardenContract(garden, opts)`** — up to 9 findings, all
  bucket `cool` except invasive (`check`), emitted only when their datum is present:
  - **`hardiness-zone`** (neutral): measure `{value: frost.days, unit:'growing_season_days'}`; USDA zone +
    frost dates in copy. USDA PHZM.
  - **`native-plants` / `local-birds` / `butterflies`** (favorable): `{value: count, unit:'species'}` +
    example names. iNaturalist.
  - **`local-wildlife`** (neutral): species count; a deer/garden note when a deer species is present.
  - **`invasive-plants`** (**check**, neutral): count + gardening heads-up.
  - **`monarch-corridor` / `firefly-habitat`** (favorable): when in range; `modeled:true` (state-range models).
  - **`microclimate`** (neutral): `{value: elevationFt, unit:'feet'}` + solar-angle / winter-shadow note. USGS.
- **`src/services/reportBuilder.js`:** `contract.chapters.garden` wired additively (from `chapters.gardenData`).

## Constraint handling

- **CONSTRAINT-001/008:** species counts are observational facts (iNaturalist research-grade), not quality
  scores; favorable tone is an amenity signal (cf. recreation), never a composite rating. The species `sci`
  (scientific name) is read into copy but not emitted as a key (a test asserts no `"sci"`/`"color"` leak).
- **Honest provenance:** monarch/firefly are state-range models → `modeled:true`; counts/zone/elevation measured.
- **CONSTRAINT-015:** discretionary nature info — absent data is omitted (no empty section), like recreation.

## Tests (+13, +3 snapshots) — full suite **102 suites / 1852 tests green** (was 101/1839)

- `tests/modules/garden/contract.test.js` (new): hardiness measure/copy; species counts cool/favorable;
  wildlife deer-note; invasive check bucket; monarch/firefly gated + modeled:true; microclimate elevation;
  empty arrays omit findings; no score/leak; per-address snapshots (Georgetown full, **Bozeman MT** different
  zone/flora, **Jeffersonville IN**).

## Notes / follow-on

- **13 of 14 chapters.** Remaining: **costs** (tax/insurance/utilities + cost calculator — CONSTRAINT-002
  income framing: national median only; CONSTRAINT-001 score check) and multi-source **climate**. Plus the
  deferred sensory **ambiance** items (airports/rail/light) and garden reptiles/insects generic counts (omitted for signal).
- `defaultCopy` transitional (FR-078 AC-9).
