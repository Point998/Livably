# FR-076 — Runtime Degradation Coverage (Utilities Pilot)

**Phase 2 — Specification. No code changes in this phase.**
Date: 2026-06-21
Module: `utilities` (primary: `src/modules/utilities/data.js`)
Depends on: FR-065 (sourceChain), FR-068 (degradation ledger), FR-058 (cell caching)

---

## 1. Problem statement

Utilities' runtime fallbacks are invisible to the FR-068 degradation ledger. `recordDegradation`
is only ever called from `sourceChain`, and utilities never calls `sourceChain` at runtime —
it uses two hand-rolled `||` chains:

- **Electric** (`getElectricData`, data.js:64): `getElectricFromNREL() || getElectricFromHIFLD()`
- **EV charging** (`getEvChargingData`, data.js:162): `getEvFromNREL() || getEvFromOpenChargeMap()`

When the primary fails and the fallback wins on a real report, **no degradation event is
recorded** — even though the module's `SOURCES` array makes CI's FR-063 verify harness report
the chains as healthy. The admin panel and degradation logs show nothing. This is the exact
NREL→HIFLD fallback FR-068 was built to make visible.

Secondary issues in the same module:
- 5 `catch → console.error(...) → return null` sites log to raw `console.error`, not the
  structured JSONL logger — they never reach `data/logs/*.jsonl` or the FR-028 error-memory
  analysis.

This FR is the **pilot** for the broader 7-module gap (see `discovery.md`). It proves the
sourceChain-routing + caching-parity + logging-standardization pattern on one module before
fan-out.

---

## 2. Scope

### In scope
1. Route **electric** (NREL→HIFLD) runtime fallback through `sourceChain`, recording
   degradation (`label: 'utilities-electric'`).
2. Route **EV charging** (NREL→OpenChargeMap) runtime fallback through `sourceChain`, recording
   degradation (`label: 'utilities-ev'`).
3. Replace raw `console.error` in utilities `data.js` catch sites with the structured logger
   (`logError`), preserving the existing message tags.
4. **Confirm** (audit) CONSTRAINT-015 fallbacks for electric/EV/internet — expected already
   compliant (see §6); fix only if a gap is found.

### Out of scope
- **Internet/broadband**: single source (FCC), `status: 'deferred'` (FR-062). No runtime
  fallback to record. Untouched.
- The other 6 modules (health, community, access, schools, safety, garden) — follow-up FR.
- Any change to `logic.js` / `template.js` unless the 015 audit finds a real gap.
- Changing the FR-063 verify harness or the shape/semantics of `SOURCES` entries beyond what
  routing requires.

---

## 3. Inputs / Outputs (behavioural contract)

### `getElectricData(lat, lng)` — unchanged signature
- **Input:** `lat`, `lng` (cell-centroid coords, as today).
- **Output:** the electric object (`{ utilityName, residentialRate, ownership, source }`) or
  `null`. **Identical shape to today.** The object's own `.source` field ('NREL' | 'HIFLD')
  is preserved — the template reads `u.electricSource` from it, so it must not change.
- **New behaviour:** internally uses `sourceChain`; a HIFLD win after an NREL miss records a
  `fallback` degradation event; both failing records `exhausted`.

### `getEvChargingData(lat, lng, driveOrigin, getDriveTime, cell)` — unchanged signature
- **Output:** `{ level2, dcFast, source }` or `null`. Identical shape. `.source`
  ('NREL' | 'OpenChargeMap') preserved.
- **New behaviour:** sourceChain orchestration + degradation recording
  (`label: 'utilities-ev'`).

### Degradation events emitted (consumed by FR-068 ledger)
| Situation | kind | label | source |
|---|---|---|---|
| NREL electric miss, HIFLD wins | `fallback` | utilities-electric | (HIFLD source name) |
| Both electric sources fail | `exhausted` | utilities-electric | null |
| NREL EV miss, OCM wins | `fallback` | utilities-ev | (OCM source name) |
| Both EV sources fail | `exhausted` | utilities-ev | null |
| Primary succeeds first | (nothing) | — | — |

`source` naming follows whatever the runtime source descriptors use (see §5 design decision).

---

## 4. Edge cases

1. **NREL returns "no data" string** → `getElectricFromNREL` already returns `null` (rate
   coerces to NaN). sourceChain treats `null` as a miss and tries HIFLD. Must still record a
   `fallback` if HIFLD wins. ✅ behaviour preserved.
2. **All electric sources fail** → `getElectricData` returns `null`; `exhausted` recorded;
   template renders State-3 actionable fallback (OpenEI + state PSC). Must not throw.
3. **Total utilities miss (electric + EV + internet all null)** → FR-058 rule: **must NOT be
   cached** for the 30-day TTL (data.js:238). Routing must preserve this — the cache decision
   reads the assembled `result`, downstream of these functions, so it should be unaffected, but
   a test must lock it.
4. **Partial result (electric present, EV null)** → still cached (existing behaviour). Locked
   by test.
5. **No active ledger context** (verify harness, scripts, direct unit calls) →
   `recordDegradation` no-ops (degradationLedger.js:31). Functions must work identically with
   or without a ledger. ✅ guaranteed by FR-068 design; assert in a no-context test.
6. **EV runtime args** → the runtime EV sourceChain call must thread the real `driveOrigin`,
   `getDriveTime`, `cell` — NOT the `async () => null` stub the `SOURCES` array uses for the
   verify harness. (Design decision §5.)
7. **`getDriveTime` throws inside EV shaping** → already caught locally, degrades to distance-
   only (data.js:91, 139). Unchanged; not a sourceChain concern.

---

## 5. Key design decision (resolve in Phase 3)

**How to define the runtime source list passed to `sourceChain`.**

The exported `SOURCES` array is built for the FR-063 verify harness and is unsuitable for
runtime reuse as-is:
- EV entries stub `getDriveTime` as `async () => null` and pass synthetic `ctx.lat,ctx.lng`
  as the drive origin — wrong for a real report.
- FCC entry is `status: 'deferred'`.

**Recommended:** define small, purpose-built runtime source arrays inside `getElectricData` /
`getEvChargingData` that call the existing `getElectricFromNREL/HIFLD` and
`getEvFromNREL/OpenChargeMap` functions with the real runtime args, and pass them to
`sourceChain`. Keep `SOURCES` (verify harness) as the separate concern it already is. Document
the intentional duality so a future reader doesn't think they drifted by accident.

*Rejected alternative:* refactoring `SOURCES` into a shared runtime+verify structure — larger
blast radius, couples the verify harness to runtime arg threading. Out of scope for a pilot.

---

## 6. CONSTRAINT-015 audit (expected: PASS)

Verified during Phase 1 that `template.js` already provides actionable fallbacks:
- **Electric State 3** (no provider): OpenEI Utility Rate DB link + state PSC site (template.js:21–27, 130–132).
- **Electric State 2** (provider, no rate / HIFLD): state-average context + HIFLD provenance disclaimer (template.js:35–45).
- **EV none**: `evFallback()`.
- **Internet none**: `internetFallback()` → FCC map link + satellite line.

Acceptance: audit confirms each `null` path renders a named URL/instruction, not an empty
section. If confirmed (expected), no template change. If a gap is found, fix it and note it.

---

## 7. Acceptance criteria

- [ ] **AC-1** A report where NREL electric fails and HIFLD succeeds records exactly one
  `fallback` event with `label: 'utilities-electric'` in the request ledger.
- [ ] **AC-2** A report where both electric sources fail records one `exhausted` event
  (`utilities-electric`) and `getElectricData` returns `null`.
- [ ] **AC-3** EV equivalents of AC-1/AC-2 with `label: 'utilities-ev'`.
- [ ] **AC-4** When the primary source succeeds first, **no** degradation event is recorded
  (happy path stays free).
- [ ] **AC-5** Return shapes of `getElectricData` / `getEvChargingData` are byte-for-byte
  unchanged (incl. the `.source` field the template depends on). Existing utilities tests pass
  untouched.
- [ ] **AC-6** FR-058 caching preserved: all-null result not cached; partial result cached
  (regression test).
- [ ] **AC-7** No raw `console.error` remains in utilities `data.js`; catch sites use `logError`.
- [ ] **AC-8** Functions behave identically with no active ledger context (no throw, same
  return) — verify-harness / direct-call safety.
- [ ] **AC-9** CONSTRAINT-015 audit recorded; electric/EV/internet null paths render actionable
  fallbacks.
- [ ] **AC-10** Tests cover all 5 addresses incl. **Jeffersonville IN** (CONSTRAINT-011), and
  the full suite stays green.

---

## 8. Constraints in play

- **CONSTRAINT-014** — coherence via the shared primitive: use `sourceChain`, add no parallel
  fallback mechanism.
- **CONSTRAINT-011** — tests required; Jeffersonville IN case.
- **CONSTRAINT-015** — actionable fallback audit (§6).
- **CONSTRAINT-009** — no design decisions leak into data.js; this stays pure data/orchestration.
- **CONSTRAINT-001** — no scoring introduced (none here).

---

## 9. Phase 2 exit

No code changed. Ready for Phase 3 (implementation-plan.md) on Nathan's go — which will order
tasks data → logic → template, resolve §5, and write the test list before any implementation.
