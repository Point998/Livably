# FR-095 — Implementation plan

## Layer impact

- **data.js** — no change. `airports`/`rail`/`lightPollution` already on the `environment` object.
- **logic.js** — no change. Tone helpers live in `contract.js` alongside the existing
  `toneFromColor` / `floodTone` / `radonTone` (the contract owns tone derivation; logic owns
  classification). Keeping the new tone helpers in `contract.js` matches the established file's pattern.
- **template.js** — no change (byte-unchanged; SSR keeps its own prose path).
- **reportBuilder.js** — no change (already wires `buildEnvironmentContract(chapters.environment, …)`).
- **contract.js** — the only source change: 3 tone helpers + 3 `push()` blocks appended after the
  existing guard, before the `provenanceSummary` computation.
- **tests** — new assertions + snapshot fixture updates.

## Ordered tasks (TDD: test first within each)

1. **Tests first.** In `tests/modules/sensory/contract.test.js`:
   - Add `airports`/`rail`/`lightPollution` to the shared `full` fixture so the existing
     "full input" cases now also exercise ambiance.
   - New `describe`/`test` blocks: `airport-noise` (near/far/none bands + source flip + no fallback),
     `rail-proximity` (near/far/none bands + no fallback), `light-pollution` (bucket `cool`,
     measure, tone favorable≤3/neutral, `modeled:true`).
   - Extend AC-6 leak test to assert no raw `"bortle"`/`"label"`/`"desc"` keys.
   - Add ambiance data to the per-address snapshot fixtures (Georgetown / Harlan / **Jeffersonville**).
   - Keep the existing "ambiance-only → null" test (AC-5) — must still pass unchanged.
   - Run jest → RED (new finding ids not yet emitted).

2. **Implement in `contract.js`:**
   - Add `airportTone(distanceMiles)`, `railTone(distanceMiles)`, `bortleTone(bortle)` next to the
     existing tone helpers.
   - After the hazard-proximity block (before `provenanceSummary`), append three `push()` blocks
     destructuring `airports`/`rail`/`lightPollution` from `environment`.
   - Round in the contract layer (`Math.round(d*10)/10` airport, `Math.round(d*100)/100` rail).
   - Run jest → GREEN for the new assertions.

3. **Snapshots:** `jest -u` for `tests/modules/sensory/contract.test.js`, then **inspect the diff** to
   confirm the new findings look right (ids, tones, measures, no leaked keys) before accepting.

4. **Full suite:** `npx jest` — all 105 suites green. Confirm no other snapshot (e.g. an integration
   report snapshot) consumes the contract and needs updating.

## Risks / unknowns

- **R1 — guard regression.** Easy to "improve" the guard to include ambiance; that breaks AC-5 and the
  FR-090 empty-contract test. Mitigation: leave the guard literally unchanged; the AC-5 test guards it.
- **R2 — `null` vs `[]` for airports.** data.js returns `null`; tests cover `null`. Handle `[]`
  defensively (`airports?.length`) so a future data-layer change doesn't silently mislabel.
- **R3 — leak of `category`/`color`.** `lightPollution` has no color key, but `label`/`desc` are prose;
  only place them inside `defaultCopy`, never as structured fields. AC-6 test enforces.
- **R4 — integration snapshot.** If a top-level report/api snapshot serializes the contract, it will
  gain 3 findings. Check for and update any such snapshot in step 4 (expected, benign).
