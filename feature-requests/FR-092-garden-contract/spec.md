# FR-092 — Garden / "What Will Grow" chapter → headless report contract (rollout #13)

**Status:** Spec · **Module:** `src/modules/garden/contract.js` (new) + wiring in `reportBuilder.js`
**Origin:** contract rollout (FR-078) · **Date:** 2026-06-23 · **Schema:** no change (1.0)

## Problem / goal

Migrate the garden / "What Will Grow" chapter (hardiness zone, native/invasive flora, local fauna,
pollinator habitat, microclimate) to the contract. A rich "Cool Things to Know" nature chapter — all
factual counts / categorical data; no scores, no Fair-Housing concerns. Added additively as
`contract.chapters.garden`. **13 of 14 chapters** after this.

## Inputs

`buildGardenContract(garden, opts)` where `garden` (`chapters.gardenData`, or `null`) =
`{ hardinessZone:{zone, frost:{lastSpring,firstFall,days}}|null, nativePlants:[{name,sci}], invasivePlants,
   wildlife, birds, butterflies, monarchCorridor:{inCorridor, milkweedSpecies}, fireflyHabitat:bool,
   microclimate:{elevationFt, solarSummerDeg, solarWinterDeg}|null, ... }`. Species arrays may be empty.
`opts = { asOf?, degraded? }`. Returns `null` when there is nothing to say (no zone, all arrays empty, no
monarch/firefly/microclimate).

## Findings produced

All bucket `cool` (a "Cool Things to Know" nature chapter) except invasive (`check`). Tone: genuine nature
perks = `favorable`; factual context = `neutral`. Emitted only when their datum is present.

1. **`hardiness-zone`** (cool, neutral): measure `{value: frost.days, unit:'growing_season_days'}` when
   frost present (else no measure); defaultCopy = USDA zone + last-spring/first-fall frost dates. Provenance
   USDA Plant Hardiness Zone Map. (when `hardinessZone`)
2. **`native-plants`** (cool, favorable): `{value: count, unit:'species'}`; up to 4 example names. iNaturalist.
3. **`local-birds`** (cool, favorable): `{value: count, unit:'species'}`; up to 5 examples. iNaturalist.
4. **`butterflies`** (cool, favorable): `{value: count, unit:'species'}`; pollinator examples. iNaturalist.
5. **`local-wildlife`** (cool, **neutral**): `{value: count, unit:'species'}`; examples + a deer/garden note
   when a deer species is present (gardening-relevant, not purely a perk). iNaturalist.
6. **`invasive-plants`** (**check**, neutral): `{value: count, unit:'species'}`; gardening heads-up + examples.
   iNaturalist. (a "thing to check" for gardeners — informational, not alarmist.)
7. **`monarch-corridor`** (cool, favorable) when `monarchCorridor.inCorridor`: milkweed species to plant in
   defaultCopy. Provenance Xerces Society (state range), **modeled:true** (state-level).
8. **`firefly-habitat`** (cool, favorable) when `fireflyHabitat === true`. Provenance firefly range (state),
   **modeled:true**.
9. **`microclimate`** (cool, neutral) when `microclimate.elevationFt != null`: measure
   `{value: elevationFt, unit:'feet'}`; solar-angle / winter-shadow note in defaultCopy. USGS elevation.

## Edge cases & constraints

- **CONSTRAINT-001/008:** species counts are observational facts (iNaturalist research-grade), not quality
  scores; favorable tone is an amenity signal (cf. recreation), not a composite rating. No graded label/color.
- **Honest provenance:** monarch/firefly are state-range models → `modeled:true`; counts/zone/elevation measured.
- **CONSTRAINT-015:** garden is discretionary nature info — absent data is omitted (no empty section), like
  recreation. (No url fallbacks needed; the chapter simply renders fewer findings.)

## Acceptance criteria

- AC-1: full input → schema-valid, `chapterId:'garden'`, `schemaVersion:'1.0'`.
- AC-2: hardiness-zone → `{value: frost.days, unit:'growing_season_days'}`, zone+frost in copy.
- AC-3: native-plants/birds/butterflies → species count measures, cool/favorable, examples in copy.
- AC-4: local-wildlife → neutral; deer note appears when a deer species is present.
- AC-5: invasive-plants → bucket `check`, count measure, heads-up copy.
- AC-6: monarch-corridor / firefly-habitat emitted only when present; `modeled:true`.
- AC-7: microclimate → `{value: elevationFt, unit:'feet'}`, solar note in copy.
- AC-8: no `score`/`grade`/`rating`; no `"color"`/`"sci"` leak; empty species arrays omit their findings.
- AC-9: nothing present → `null`.
- AC-10: per-address snapshots incl. **Jeffersonville IN**, Georgetown (full), Bozeman MT (different flora/zone).
- AC-11: wired additively into `reportBuilder` as `chapters.garden`; full suite green incl. 5 addresses.

## Notes

- `defaultCopy` transitional (FR-078 AC-9). Deferred elsewhere: reptiles/insects generic counts (lower
  buyer-signal) — omitted to reduce noise; can be added later if wanted.
