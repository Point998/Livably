# FR-076 — Implementation Plan (Utilities Pilot)

**Phase 3 — Planning. No code changes in this phase.**
Date: 2026-06-21
Module: `utilities`

---

## Confirmed facts (from Phase 3 grounding reads)

- `reportBuilder.js:49` runs the whole report inside `runWithLedger(...)`. ⇒ the new
  `recordDegradation` calls inside utilities land automatically during a real report. **No
  pipeline wiring needed.**
- Test conventions: `global.fetch = jest.fn().mockResolvedValue/Once(...)`; degradation
  assertions wrap the call in `runWithLedger(() => { ...; return getLedger(); })`.
- Existing utilities data tests call the functions **without** a ledger context →
  `recordDegradation` no-ops there → those tests are unaffected (AC-8).

### sourceChain event semantics (critical for test correctness)
For an ordered chain `[NREL, HIFLD]` where NREL returns an invalid/null result and HIFLD wins:
- NREL invalid → records `{ kind: 'miss', source: <nrel name> }`, sets `degraded = true`.
- HIFLD valid while `degraded` → records `{ kind: 'fallback', source: <hifld name> }`, returns.

⇒ A single fallback produces **two** ledger events (one `miss` + one `fallback`).
`summarize().fallbacks === 1`. Tests assert on both, not just the fallback.

Both sources failing → each records a `miss`, then a final `{ kind: 'exhausted', source: null }`.

---

## Design decisions (resolving spec §5)

### D-1 — Runtime source arrays, not the verify-harness `SOURCES`
Define purpose-built runtime arrays inside `getElectricData` / `getEvChargingData` that call the
existing fetch functions with **real** runtime args. Do **not** reuse the exported `SOURCES`
(its EV entries stub `getDriveTime` as `async () => null` and FCC is `status:'deferred'`).
Keep `SOURCES` as the separate verify-harness concern. Add a one-line comment at each runtime
array explaining the intentional duality (prevents a future "these drifted" misread).

Source `name` values for the runtime arrays — reuse the `SOURCES` ids for consistency in the
ledger/admin panel: `'nrel-electric-rate'`, `'hifld-electric-territory'`, `'nrel-ev-charging'`,
`'openchargemap-ev'`.

### D-2 — Keep each fetch function's internal try/catch (null-returning)
The source functions stay defensive: they catch internally and return `null`. sourceChain then
sees a null result and records a `miss` (not an `error`). **Rationale:** lowest blast radius —
the functions are also referenced by the verify-harness `SOURCES` and called directly in unit
tests; making them throw would ripple. Trade-off: the ledger records `miss` rather than
`error`+reason for an internal failure. Acceptable for the pilot; richer `error` capture is a
documented future enhancement (would require letting sources throw).

### D-3 — `logError` identifier
`logError(fn, address, error)` — pass the coordinate string as the `address` slot:
`logError('getElectricFromNREL', \`${lat},${lng}\`, err)`. Preserves the existing tag intent
(`[NREL Utility Rates]`) inside the structured entry and gives a usable locator. Keep the human
tag as the `fn` arg.

---

## Task breakdown (ordered; data → logic → template → tests)

> TDD per CONSTRAINT-011 / project workflow: write/extend the test alongside each data task.

### Layer 1 — Data (`src/modules/utilities/data.js`)

**T1 — Route electric through sourceChain.**
- Import `sourceChain` from `../../shared/sourceChain`.
- Rewrite `getElectricData(lat, lng)`:
  - Build runtime array `[{ name:'nrel-electric-rate', run: () => getElectricFromNREL(lat,lng) },
    { name:'hifld-electric-territory', run: () => getElectricFromHIFLD(lat,lng) }]`.
  - `const picked = await sourceChain(arr, {}, { label: 'utilities-electric' });`
  - `return picked ? picked.value : null;`
  - Validity: default (`r != null`) is sufficient — `getElectricFromNREL` already returns null
    when rate ≤ 0, `getElectricFromHIFLD` returns null when no name. (Do NOT add a rate>0
    predicate here, or a valid HIFLD-name-only result — which has `residentialRate: null` —
    would be rejected.)
- **Preserve return shape:** `picked.value` is the exact electric object incl. `.source`. ✅

**T2 — Route EV through sourceChain.**
- Rewrite `getEvChargingData(lat, lng, driveOrigin, getDriveTime, cell)`:
  - Runtime array threading the **real** args:
    `[{ name:'nrel-ev-charging', run: () => getEvFromNREL(lat,lng,driveOrigin,getDriveTime,cell) },
      { name:'openchargemap-ev', run: () => getEvFromOpenChargeMap(lat,lng,driveOrigin,getDriveTime,cell) }]`.
  - `sourceChain(arr, {}, { label: 'utilities-ev' })`; return `.value` or null.
  - Default validity is fine (each returns null when no L2/DC found).

**T3 — Standardize logging.**
- Import `logError` from `../../logger`.
- Replace the 5 `console.error(...)` in catch blocks (`getElectricFromNREL`, `getElectricFromHIFLD`,
  `getEvFromNREL`, `getEvFromOpenChargeMap`, `getBroadbandData`) with
  `logError('<fnName>', \`${lat},${lng}\`, err)`.
- Leave the two `console.warn('[... EV drive time]')` lines as-is (non-fatal degrade-to-distance,
  not swallow sites; out of scope).
- `getUtilitiesData` keeps its `console.log('[CACHE HIT]')` (informational, not an error).

### Layer 2 — Logic (`logic.js`)
**T4 — No change expected.** `assembleUtilities` reads `.source` / shapes unchanged. Confirm by
running existing `logic.test.js`. No task unless a test fails.

### Layer 3 — Template (`template.js`)
**T5 — CONSTRAINT-015 audit (no change expected).** Confirm the three electric states + EV +
internet fallbacks still render (Phase-1 read shows they do). Document the audit result in
`summary.md`. Change only if a gap is found.

### Layer 4 — Tests (`tests/modules/utilities/`)

**T6 — Electric degradation tests (data.test.js).**
- `import { runWithLedger, getLedger, summarize }`.
- *Fallback:* `fetch` → NREL `ok:true` but `outputs:{}` (no rate → null) on call 1, HIFLD valid
  fixture on call 2. Wrap `getElectricData` in `runWithLedger`; assert: returns HIFLD object
  (`source:'HIFLD'`); ledger has a `miss` (nrel) + a `fallback` (hifld); `summarize().fallbacks===1`.
- *Exhausted:* both calls fail (`ok:false`); assert returns `null`; ledger has 2 `miss` + 1
  `exhausted`; `summarize().exhausted===1`.
- *Happy path:* NREL valid on call 1; assert returns NREL object; **ledger empty** (AC-4).

**T7 — EV degradation tests (data.test.js).** Same three shapes with `label:'utilities-ev'`,
NREL-EV primary → OpenChargeMap fallback (OCM requires `OPENCHARGEMAP_API_KEY` — set
`process.env.OPENCHARGEMAP_API_KEY` in the test and restore after). Use a `fakeDrive` stub like
the existing EV tests.

**T8 — No-context safety (AC-8).** Assert `getElectricData` / `getEvChargingData` return the same
values when called **outside** `runWithLedger` (no throw). (Largely covered by existing tests;
add one explicit assertion.)

**T9 — FR-058 caching regression (AC-6).** Via `getUtilitiesData`: (a) all three sources null →
`utilitiesCache` has no entry for the key; (b) electric present, EV+internet null → entry IS
cached. (Check whether an equivalent test already exists before adding.)

**T10 — Return-shape lock (AC-5).** Existing `getElectricData` / `getEvChargingData` shape tests
must pass unmodified. Do not edit them; if they fail, the refactor broke parity — fix the code.

**T11 — Jeffersonville IN (CONSTRAINT-011).** Ensure an existing integration/address test exercises
utilities for Jeffersonville IN, or add a data-level case. Confirm no regression.

### Layer 5 — Verify & document
**T12** — Run full suite (`npm test`); confirm 1,649+ all green. Run lint/build if present.
**T13** — Write `summary.md` (what changed, 015 audit result, test counts, 5-address note,
D-1/D-2/D-3 decisions, the documented `miss`-vs-`error` trade-off).
**T14** — Commit + push on a branch `FR-076-runtime-degradation-coverage`; open PR per the
auto-PR workflow (work done + green). Roadmap update folded into the same PR.

---

## Risks & unknowns

| # | Risk | Mitigation |
|---|---|---|
| R1 | Adding a rate>0 validity predicate in the electric chain would reject a valid HIFLD name-only result (rate=null). | D-1/T1: rely on default `r != null`; the functions already gate their own validity. Explicit note in code. |
| R2 | EV runtime args mis-threaded (using the verify stub) → drive times break. | D-1: build the runtime array with the real `driveOrigin/getDriveTime/cell`; T7 asserts driveTimeMinutes present. |
| R3 | Test asserts "one fallback event" but sourceChain emits miss+fallback → false failure. | Documented in §sourceChain semantics; T6/T7 assert both events. |
| R4 | `logError` address slot misuse changes log schema consumed by FR-028 error-memory. | D-3 passes a string (coord) in the existing `address` field — schema-compatible; `errorMsg` still populated. |
| R5 | Hidden caller depends on `console.error` output (e.g. a log scraper). | Unlikely; structured logger is the project standard (FR-068). Grep for `[NREL Utility Rates]` string consumers before deleting — expect none. |
| R6 | Caching test reveals all-null IS currently cached (spec assumption wrong). | T9 is a characterization test first; if it fails, that's a real bug to log, not a plan error. |

## Out of scope (restate)
Internet/FCC routing; the other 6 modules; any logic/template change beyond a found 015 gap;
refactoring the verify-harness `SOURCES`; making source functions throw (future enhancement).

## Phase 3 exit
No code changed. On approval → Phase 4: execute T1–T14 in order, tests alongside code.
