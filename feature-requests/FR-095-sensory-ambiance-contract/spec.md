# FR-095 — Sensory ambiance → report contract (rollout #16, completes the contract)

## Summary

The headless report contract (FR-078) reached every numbered chapter + climate across FR-078→FR-094.
`buildEnvironmentContract` (the sensory module's contract, FR-090) maps only the **environmental
health & safety** findings (flood, air, road-noise, water, radon, hazard). The sensory **ambiance**
items — airports, rail, light pollution — were explicitly deferred (see the header comment in
`src/modules/sensory/contract.js`, lines 4–6). This FR adds them, finishing the contract rollout 100%.

Additive only. **No schema change** (`schemaVersion` stays `1.0`). **SSR `template.js` byte-unchanged**
(same discipline as rollouts #1–15). reportBuilder is **unchanged** — it already passes the full
`chapters.environment` object (which already contains `airports`/`rail`/`lightPollution`) to the builder.

## Module

`src/modules/sensory/` — extends `contract.js` (`buildEnvironmentContract`). No new module, no new file.

## Inputs

All three already produced by `getEnvironmentalData` (data.js) and present on the `environment` object:

| Field | Shape | `null` meaning |
|---|---|---|
| `environment.airports` | `Array<{ name, distanceMiles, lat, lng, source? }>` sorted nearest-first | confirmed **none within 20 mi** (not "data unavailable" — Google & OSM both return `null` for the empty case) |
| `environment.rail` | nearest `{ type, name, distanceMiles }` | confirmed **no rail within ~3 mi** |
| `environment.lightPollution` | `{ bortle, label, desc }` — **always present** (`estimateBortle` never returns null) | n/a |

## Outputs — three new findings appended to `findings[]`

### 1. `airport-noise`
- **bucket:** `consider` (sensory family, consistent with existing `road-noise`)
- **claim.subject:** `'Nearest airport'`
- **claim.measure:** nearest present → `{ value: <distanceMiles, rounded to 0.1>, unit: 'miles' }`; none → `null`
- **tone:** `airportTone(distanceMiles)` — `< 5` → `caution`, `< 15` → `neutral`, `>= 15` → `favorable`; **none in range → `favorable`**
- **provenance:** `source` = `airports[0].source === 'osm' ? 'OpenStreetMap' : 'Google Places'`; `modeled: false`; `asOf`. (None-case source defaults to `'Google Places'` — the primary provider whose empty answer is being reported.)
- **fallbackAction:** `null` in all cases (a confirmed "none in range" is a *complete* answer, not missing data — this is the key contrast with the health/safety `*-missing` findings)
- **defaultCopy:** nearest → `"<name> is <d> miles away…"`; none → `"No airports within 20 miles — flight traffic is not a daily factor here."`

### 2. `rail-proximity`
- **bucket:** `consider`
- **claim.subject:** `'Nearest rail line'`
- **claim.measure:** present → `{ value: <distanceMiles, rounded 0.01>, unit: 'miles' }`; none → `null`
- **tone:** `railTone(distanceMiles)` — `< 0.25` → `caution`, `< 0.75` → `neutral`, `>= 0.75` → `favorable`; **none → `favorable`**
- **provenance:** `source: 'OpenStreetMap'`, `modeled: false`, `asOf`
- **fallbackAction:** `null`
- **defaultCopy:** present → `"A <type> line runs ~<d> miles away…"`; none → `"No rail lines within ~3 miles — train noise is not a factor here."`

### 3. `light-pollution`
- **bucket:** `cool` (night-sky quality — the archetypal "Cool Thing to Know")
- **claim.subject:** `'Night sky brightness (Bortle class)'`
- **claim.measure:** `{ value: bortle, unit: 'bortle_class' }` — an **external standard index** (Bortle), surfaced like AQI/DNL already are; NOT a Livably composite (CONSTRAINT-001 satisfied)
- **tone:** `bortleTone(bortle)` — `<= 3` → `favorable` (dark sky), else `neutral`. Never `caution` (light level is not a hazard).
- **provenance:** `source: 'U.S. Census ACS / OpenStreetMap'`, **`modeled: true`** (estimated from population density + land use, not satellite-measured — honest provenance), `asOf`
- **fallbackAction:** `null`
- **defaultCopy:** `"<label>: <desc> Estimated from Census tract density and nearby land use, not satellite-measured."`

## Edge cases

- **Ambiance-only input still returns `null`.** The existing top guard
  (`if (!airQuality && !floodRisk && !roadNoise && !waterQuality && !radon && !ejscreen) return null;`)
  **must stay keyed to health/safety**. `lightPollution` is always present, so gating off it would make
  *every* call emit a chapter — breaking the FR-090 "empty → null" contract and its test
  (`buildEnvironmentContract({ airports:[{name:'X'}] })` → `null`). Ambiance findings are appended
  **after** this guard, so they ride along only when the chapter already emits.
- `airports` empty array `[]` is treated the same as `null` (no nearest) — defensive, though data.js
  returns `null` not `[]`.
- `lightPollution` missing/malformed (defensive, shouldn't happen): skip the finding rather than throw.
- Rounding lives in the contract layer (presentation-neutral numeric rounding, not a design decision).

## Acceptance criteria

- **AC-1** Schema-valid `ChapterContract`; `chapterId` `'environment'`, `schemaVersion` `'1.0'`.
- **AC-2** `airport-noise`: nearest present → `consider`, measure `{value, unit:'miles'}`, tone by distance band; provenance source flips OSM vs Google by `source`; **none → favorable, measure null, no fallbackAction**.
- **AC-3** `rail-proximity`: tone by distance band; none → favorable; measure null when none; no fallbackAction.
- **AC-4** `light-pollution`: bucket `cool`; measure `{value:bortle, unit:'bortle_class'}`; tone favorable for bortle ≤ 3 else neutral; `provenance.modeled === true`.
- **AC-5** Ambiance-only input (no health/safety) still returns `null` (existing guard preserved).
- **AC-6 (CONSTRAINT-001/008)** No `score`/`grade`/`rating`; no `"color"`/`"category"`/`"label"`/`"desc"`/`"bortle"` raw keys leak into JSON (only inside `defaultCopy` strings / the `bortle_class` measure value).
- **AC-7** `provenanceSummary` includes the new ambiance sources and stays deduped.
- **AC-8 (CONSTRAINT-011)** Per-address snapshots updated incl. Jeffersonville IN; full jest suite green.

## Constraint check

- **CONSTRAINT-001** — Bortle/distance are external/factual measures, not Livably composites. ✓
- **CONSTRAINT-008** — tone derived from numbers; no color/label/category keys emitted. ✓
- **CONSTRAINT-015** — confirmed "none in range" is a complete answer; `fallbackAction:null` is correct (the actionable-fallback rule applies to *missing/dead* data, which this is not). ✓
- **Honest provenance** — light pollution `modeled:true`; airport/rail straight-line distance `modeled:false` (located facilities). ✓
