# FR-076 — Summary (Utilities Pilot)

**Phase 4 — Implementation complete.**
Date: 2026-06-21
Branch: `FR-076-runtime-degradation-coverage`
Module: `utilities`

---

## What shipped

Closed the runtime degradation-observability blind spot in the **utilities** module — the pilot
for the broader 7-module gap found in discovery. Utilities' two hand-rolled `||` runtime
fallbacks now route through `sourceChain`, so a real-report fallback is recorded in the FR-068
degradation ledger (and surfaces in the admin panel + degradation log line).

### Code changes (`src/modules/utilities/data.js` only)
1. **Electric** (`getElectricData`): `NREL || HIFLD` → `sourceChain([nrel, hifld], …, { label: 'utilities-electric' })`.
2. **EV** (`getEvChargingData`): `NREL || OpenChargeMap` → `sourceChain([nrel, ocm], …, { label: 'utilities-ev' })`, threading the **real** `driveOrigin/getDriveTime/cell` (not the verify-harness stub).
3. **Logging standardized**: 5 `catch → console.error(...)` sites → `logError(fn, \`${lat},${lng}\`, err)` (structured JSONL logger; reaches FR-028 error-memory analysis).
4. **`chainLog` helper** added (resilience-track convention) so sourceChain miss/error visibility goes through the structured logger, not `console.warn`.

Return shapes are **byte-for-byte unchanged** (incl. each result's own `.source` field that
`template.js` reads via `u.electricSource`/`u.evSource`). `logic.js` and `template.js`
untouched.

### Design decisions (from plan)
- **D-1** Purpose-built runtime source arrays (real args) rather than reusing the verify-harness
  `SOURCES` (whose EV entries stub `getDriveTime` and whose FCC entry is `status:'deferred'`).
  Source `name`s reuse the `SOURCES` ids for ledger/admin-panel consistency.
- **D-2** Each fetch function keeps its internal try/catch (null-returning). sourceChain therefore
  records a `miss` (not `error`+reason) on an internal failure. Lowest blast radius; richer
  `error` capture (letting sources throw) is a documented future enhancement.
- **D-3** `logError`'s address slot carries the `lat,lng` string (data layer has no street address).

### Out of scope (unchanged, by design)
- Internet/FCC (single source, `status:'deferred'` per FR-062 — no runtime fallback to record).
- The other 6 SOURCES-but-no-runtime-sourceChain modules (health, community, access, schools,
  safety, garden) — follow-up FR, this being the proven pattern.

---

## CONSTRAINT-015 audit (result: PASS — no change needed)

`template.js` already renders named, actionable fallbacks for every `null` path:
- **Electric — no provider** (State 3): OpenEI Utility Rate Database link + state PSC site
  (template.js `buildElectricSection` / `buildElectricTab`).
- **Electric — provider known, rate unknown** (HIFLD, State 2): state-average context + a
  "Provider via HIFLD Electric Retail Service Territories" provenance disclaimer.
- **EV — none**: `evFallback()`.
- **Internet — none**: `internetFallback()` → FCC National Broadband Map link + satellite line.

No empty/silent sections. No template change required.

---

## Tests (CONSTRAINT-011)

Added 8 tests to `tests/modules/utilities/data.test.js`:
- `utilities-electric` recording: NREL-miss→HIFLD-win (one `fallback` + a `miss`); both-fail
  (`exhausted` + two `miss`, returns null); first-source-success (records nothing); **Jeffersonville
  IN** coordinates regression case.
- `utilities-ev` recording: NREL-miss→OCM-win (`fallback`); both-fail (`exhausted`);
  first-source-success (nothing).
- No-active-ledger safety (AC-8): fallback works identically and records nothing outside
  `runWithLedger`.

Existing shape/orchestration tests (lines 139–218) and FR-058 caching tests (lines 85–117) kept
**unmodified** and green — they lock return-shape parity (AC-5) and the "don't cache an all-null
miss" rule (AC-6).

**Full suite: 87 suites / 1,657 tests green** (1,649 baseline + 8). Verified locally.

### Acceptance criteria
AC-1…AC-10 all met. (AC-9 = the PASS audit above; AC-5/AC-6 via the preserved existing tests.)

---

## Notes for the follow-up FR (fan-out)
The pattern proven here transfers directly: for each remaining module, classify single-source
vs multi-source-bypass, route confirmed multi-source runtime fallbacks through `sourceChain`
with a `utilities-*`-style `label` + `chainLog`, swap raw `console.error` for `logError`, and
audit CONSTRAINT-015. `health`/`reachability` already partly there; `community`/`access`/
`schools`/`safety`/`garden` still to classify.
