# FR-094 — Climate chapter → headless report contract (rollout #15, the real last chapter)

**Status:** Spec · **Module:** `src/modules/climate/{logic,contract}.js` + wiring in `services/reportBuilder.js`
**Origin:** contract rollout (FR-078). Climate was a roadmap recount miss — a separate real chapter still
off the contract after the 14 numbered chapters. **Schema:** no change (1.0)
**Design call (Nathan, 2026-06-24):** include **tornado-frequency**; move `getTornadoTier` into
`climate/logic.js` (pure rule belongs there), contract consumes it with `state` threaded via opts. SSR
`template.js` is **untouched** (matches rollouts #1–14); the template's `getTornadoTier` copy is left in
place, duplication logged as a `// shortcut:`.

## Problem / goal

Migrate the **climate** chapter ("Climate & Weather Risks") to the contract. The chapter renders from two
sources — `environment` (flood/AQI/radon/noise/water/hazard — **already contracted via FR-090**) **+
`climateHistory`**. This FR covers only the **`climateHistory`-specific facts**; **flood is an explicit
non-goal** (environment owns it). climate is value-neutral context: heat/cold days, disaster history, and
watershed are descriptive facts (neutral tone, per growth FR-091); genuine cautions only for high seismic
and a lowpoint drainage position. External standard indices (USGS seismic `pga`, FEMA declarations, NOAA
normals) are factual measures (external-index principle, FR-090) — never a composite climate score
(CONSTRAINT-001). Added additively as `contract.chapters.climate`.

## Approach

1. **Logic (new `climate/logic.js` export):** move `getTornadoTier(state)` (pure `TORNADO_TIER` lookup,
   currently in `template.js`) into `logic.js` and export it. `// shortcut:` notes the template keeps its
   duplicate copy (surgical — template untouched).
2. **Contract (new `climate/contract.js`):** `buildClimateContract(climateHistory, opts)` maps the
   already-processed `climateHistory` into findings. `opts` carries `state`/`county`/`asOf`/`degraded`.
3. **Wiring:** `chapters.climateHistory ? buildClimateContract(chapters.climateHistory, { degraded, state, county }) : null` in `reportBuilder.js`.
4. **Template (`climate/template.js`): unchanged.**

## Inputs

`buildClimateContract(climateHistory, opts)` where `climateHistory` (or `null`) =
- `seismic`: `{pga, band, label, color, promote, narrative, ...} | null` (from `getSeismicContext`).
- `climateNormals`: `{annual:{daysAbove90, daysAbove95, daysBelow32}, stationName, normalsSource} | null` — `normalsSource` is `'NOAA'` (measured) or `'model'` (Open-Meteo, modeled).
- `femaDeclarations`: `{count, ...}`; `glance.lastSignificantEvent`: `{type, year} | null`.
- `watershed`: `{topographicPosition: 'uphill'|'midslope'|'lowpoint'|null, named:{huc12Name, basinName}} | null`.
- `preparedness.emergencySystem`: `{tier, name, url, searchUrl, note}` (always present when climateHistory present).
- `opts = { asOf?, degraded?, state?, county? }`. Returns `null` when `climateHistory` is absent.

## Findings produced

Display order = list order. Flood, monthly normals table, and storm-event lists stay SSR-only (not contracted).

1. **`seismic-hazard`** — only when `seismic` present. `pga` is a USGS standard index → factual measure.
   - bucket: `promote` (moderate+)→`check`, else `cool`. tone: `very-low`/`low`→`favorable`, `moderate`/`high`/`very-high`→`caution`.
   - claim.subject `'Earthquake ground motion (USGS)'`, measure `{value: pga, unit: 'g_pga'}`, comparison `null`.
   - provenance `{source:'USGS ASCE 7-16', asOf, modeled:false}`. `defaultCopy = seismic.narrative`.
   - **Drop `band`/`label`/`color`/`promote`/`ss`/`s1`/`sds`** — derive tone, never emit a graded label (CONSTRAINT-001/008).

2. **`hot-days`** — when `climateNormals?.annual?.daysAbove90` is finite. cool/neutral.
   - subject `'Days per year at or above 90°F'`, measure `{value, unit:'days_per_year'}`. provenance per `normalsSource`
     (`'NOAA'`→`{source:'NOAA 30-yr normals', modeled:false}`, else `{source:'Open-Meteo ERA5 modeled normals', modeled:true}`).

3. **`cold-days`** — when `climateNormals?.annual?.daysBelow32` is finite. cool/neutral. subject `'Days per year at or below 32°F'`,
   measure `{value, unit:'days_per_year'}`. provenance same rule as hot-days.

4. **`disaster-history`** — always (when climateHistory present). FEMA weather-related declaration count.
   - measure `{value: femaDeclarations.count, unit:'federal_disaster_declarations'}`, comparison `null`.
   - count `0`→`cool`/`favorable` (copy: "No federally declared weather disasters in {N} years."); `>0`→`consider`/`neutral`
     (copy: "{county} — {count} federal weather-related disaster declaration(s) in {N} years" + last significant event when present).
   - provenance `{source:'FEMA', asOf, modeled:false}`. (`N` = `CLIMATE_FEMA_LOOKBACK_YEARS`.)

5. **`tornado-frequency`** — `getTornadoTier(opts.state)`; **omit when state absent or tier `'Unknown'`**.
   - tone: `High`→`caution`, `Moderate`→`neutral`, `Low`→`favorable`. bucket: `High`→`check`, `Moderate`→`consider`, `Low`→`cool`.
   - subject `'Tornado frequency (state)'`, measure `null` (categorical — no numeric score), comparison `null`. `defaultCopy = tier note`.
   - provenance `{source:'NOAA Storm Events (state averages)', asOf, modeled:true}` (regional/state-level classification).

6. **`topographic-position`** — when `watershed?.topographicPosition` set; **midslope → omit** (template renders nothing).
   - `lowpoint`→`check`/`caution`, fallbackAction `{type:'instruction', label:'Ask the seller about water intrusion', value:<ask-seller copy>}`.
   - `uphill`→`cool`/`favorable` (copy: stormwater drains away — modest advantage). measure `null`. provenance `{source:'USGS elevation', asOf, modeled:false}`.

7. **`named-watershed`** — when `watershed?.named?.huc12Name`. cool/neutral, measure `null`,
   `defaultCopy` = "This home sits in the {huc12Name} watershed{, {basinName} basin}." provenance `{source:'USGS Watershed Boundary Dataset', asOf, modeled:false}`.

8. **`emergency-alerts`** — always (when `preparedness.emergencySystem`). check/neutral, measure `null`. CONSTRAINT-015.
   - fallbackAction: tier-1 → `{type:'url', label:'Register for emergency alerts', value: emergencySystem.url}`;
     else → `{type:'url', label:'Find your county emergency alert registration', value: emergencySystem.searchUrl}`.
   - `defaultCopy` = `emergencySystem.name` (tier 1) or `emergencySystem.note` (tier 2). provenance `{source:'Local emergency management', asOf, modeled:false}`.

## Edge cases & constraints

- **CONSTRAINT-001/008:** no composite climate score; seismic emits `pga` as a measure with **no** graded
  `band`/`label`/`color` field; tornado tier is categorical copy, no numeric rating. A test asserts no
  `score`/`grade`/`rating` token (word-boundary) and no leaked `color`/`band`/`promote`/`label` keys.
- **CONSTRAINT-016:** NOAA station validity is enforced upstream in `data.js`; the contract surfaces honest
  provenance — `normalsSource:'model'` → `modeled:true` with the Open-Meteo source name.
- **CONSTRAINT-015:** `emergency-alerts` always carries a registration URL; lowpoint carries an ask-seller instruction.
- **Flood / AQI / radon / noise / water / hazard — NOT emitted here** (environment FR-090 owns them). Explicit non-goal.
- **`climateHistory` absent → `null`** (chapter omitted; `safeBuild`).
- Value-neutral: heat/cold days, disaster count, watershed are neutral; cautions only for high seismic, lowpoint, high tornado.

## Acceptance criteria

- **AC-1 (logic):** `getTornadoTier` exported from `climate/logic.js`, pure, returns `{tier, color, note}`; `template.js` byte-unchanged.
- **AC-2:** full input → schema-valid, `chapterId:'climate'`, `schemaVersion:'1.0'`.
- **AC-3 (seismic):** present → `seismic-hazard` with `{value:pga, unit:'g_pga'}`; tone/bucket per band (low→cool/favorable, moderate+→check/caution); narrative in `defaultCopy`; no `band`/`label`/`color` leak. Absent → no finding.
- **AC-4 (normals):** `daysAbove90`/`daysBelow32` finite → `hot-days`/`cold-days` (cool/neutral, `days_per_year`); `normalsSource:'model'` → `modeled:true` + Open-Meteo source; `'NOAA'` → `modeled:false`.
- **AC-5 (disaster history):** count 0 → cool/favorable + "no disasters" copy; count>0 → consider/neutral + count/last-event copy; FEMA modeled:false.
- **AC-6 (tornado):** High→check/caution, Moderate→consider/neutral, Low→cool/favorable; state absent or Unknown → omitted; modeled:true.
- **AC-7 (topographic):** lowpoint→check/caution + ask-seller instruction fallback; uphill→cool/favorable; midslope → omitted.
- **AC-8:** `named-watershed` (cool/neutral) when huc12 present; `emergency-alerts` always present with a URL fallback (tier-1 url vs tier-2 searchUrl).
- **AC-9 (CONSTRAINT-001):** no `score`/`grade`/`rating` anywhere; no leaked `color`/`band`/`promote`/`label` keys.
- **AC-10:** `climateHistory` absent → `null`.
- **AC-11:** per-address snapshots incl. **Jeffersonville IN** (high tornado) + **Bozeman MT** (moderate tornado, different climate) + a synthetic **low-tornado** fixture (e.g. CA/NJ — no live test address is low-tornado: KY/IN are high, MT moderate) + a seismically-active fixture (high `pga`, since KY/IN/MT are low seismic).
- **AC-12:** wired additively into `reportBuilder` as `chapters.climate`; full suite green incl. 5 addresses; `climate/template.js` byte-unchanged.

## Notes

- `defaultCopy` transitional (FR-078 AC-9).
- `// shortcut:` to log in `climate/logic.js`: *"getTornadoTier is also defined in climate/template.js; logic.js
  is now the source for the contract but the SSR template copy was left in place (surgical, matches rollouts
  #1–14). Collapse onto the logic.js export when the template is next touched."*
- After climate: only the deferred sensory **ambiance** items (airports/rail/light) remain — a small additive FR to `sensory/contract.js`.
