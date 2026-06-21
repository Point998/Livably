# FR-076 — Runtime Degradation Coverage & Swallow-Site Audit

**Phase 1 — Discovery (read-only). No code changes in this phase.**
Date: 2026-06-21
Author: Claude (Opus 4.8) with Nathan

---

## Origin

Roadmap parked item (session-3/4 hand-off): *"broader try/catch → null swallow-site sweep."*
Per the verify-the-hand-off-against-code rule, the framing was checked against the
codebase before scoping. It was **partly wrong** — the real, higher-value finding is a
structural observability gap, documented below. The naive "swap console.error for the
logger" reading would have shipped low value and missed the actual hole.

---

## What exists today

### The resilience substrate (already built — do not duplicate)
- **`src/shared/sourceChain.js`** (FR-065): ordered source runner. First source that
  passes `isValid` wins, tagged with provenance. **This is the only place that records
  degradation** — it calls `recordDegradation()` on miss / fallback / exhausted.
- **`src/shared/degradationLedger.js`** (FR-068): `AsyncLocalStorage`-scoped, request-
  scoped ledger. `recordDegradation()` pushes events; `summarize()` rolls them up for the
  admin panel + one structured `logDegradation` line per degraded report.
- **`src/logger.js`**: structured JSONL logger (`logRequest`, `logError`, `logDegradation`).
  Crash-safe (never throws).

### Verified facts (grep + file reads)
1. **`recordDegradation` is referenced in only 2 files**: `degradationLedger.js` (def) and
   `sourceChain.js` (caller). ⇒ **If a module does not call `sourceChain()` at runtime, its
   degradation is never recorded.** This is the linchpin.
2. **14 modules define a `SOURCES` array** (climate, garden, property, growth, sensory,
   recreation, walkability, reachability, safety, schools, utilities, access, community,
   health). `SOURCES` feeds the **FR-063 verification harness** — i.e. CI proves the sources
   are reachable. It does **not** imply the runtime path uses them.
3. **Only 9 call `sourceChain()` at runtime**: shared `census`, shared `elevation`, and
   modules `climate`, `reachability`, `walkability`, `recreation`, `sensory`, `property`,
   `growth`. These record degradation correctly.
4. **7 modules define `SOURCES` but never call `sourceChain()` at runtime**:
   **utilities, health, community, access, schools, safety, garden.**
   Their real-report fallbacks are invisible to the FR-068 ledger.
5. **~12 data-layer swallow sites** (`catch → console.error(...) → return null`) across the
   data.js files. They log to **raw `console.error`**, not the structured logger and not the
   ledger — a second, smaller observability inconsistency.

### The clearest concrete case: `utilities`
- Runtime entry `getUtilitiesData` → `getElectricData` →
  `(await getElectricFromNREL()) || (await getElectricFromHIFLD())` — a **hand-rolled `||`
  fallback** (data.js:64). When NREL fails and HIFLD wins on a real report, **no degradation
  event is recorded**, even though this is exactly the NREL→HIFLD fallback FR-068 was meant
  to make visible.
- The module's `SOURCES` array (data.js:244–262) wraps the *same* functions but is only
  consumed by the verify harness. So CI is green and the admin panel shows nothing — a false
  sense of coverage.

---

## What's missing / the gap

1. **Runtime degradation blind spot** in the 7 non-`sourceChain` modules. `utilities` is a
   *confirmed* multi-source bypass (`||` chain). The other 6 are **unclassified**: each is
   either (a) genuinely single-source at runtime (no fallback to record — only the logging +
   CONSTRAINT-015 concerns apply), or (b) a hidden multi-source bypass like utilities.
   **Phase 2 must classify each of the 7.**
2. **Logging inconsistency**: data-layer catch sites use `console.error` not the structured
   logger — they don't land in `data/logs/*.jsonl`, so the error-memory analysis (FR-028)
   and any aggregate view can't see them.
3. **CONSTRAINT-015 audit unverified**: every `return null` is only safe if the downstream
   `logic.js`/`template.js` renders a *named, actionable* fallback (URL / phone / specific
   instructions), not a silent empty section. `utilities/logic.js` propagates many `null`s
   (electric, utilityType, internet) — the template's handling of each is unverified.

---

## What could break (risks)

- **CONSTRAINT-014 (logic layer owns coherence)**: routing utilities through `sourceChain`
  must reuse the shared primitive, not add a parallel mechanism. Low risk — sourceChain *is*
  the shared primitive; this is moving utilities onto it.
- **Caching interaction (FR-058)**: `getUtilitiesData` cell-caches results and deliberately
  does **not** cache a total miss. Re-routing electric through `sourceChain` must preserve
  the "don't cache all-null" rule and the cell-shared short-circuit. Medium risk — needs a
  test.
- **Behaviour parity**: `sourceChain` returns `{ value, source }`; the `||` chain returns the
  raw value. The electric object already carries its own `source` field ('NREL'/'HIFLD'), so
  the adapter must not double-wrap. Low/medium risk.
- **Verify harness duplication**: `SOURCES` entries and the runtime sourceChain call must not
  drift. Ideally the runtime call consumes the same `SOURCES` array so there's one source of
  truth. Worth a design decision in Phase 2.
- **Test surface**: CONSTRAINT-011 — any module touched needs tests, and Jeffersonville IN
  must be a case. Degradation-recording assertions are new test territory.

---

## Relevant constraints & prior art

- **CONSTRAINT-015** (graceful degradation → actionable fallback, not silence) — the audit anchor.
- **CONSTRAINT-014** (logic layer owns coherence; one shared mechanism) — use sourceChain.
- **CONSTRAINT-011** (no feature without tests; Jeffersonville IN case).
- **FR-065** (sourceChain), **FR-068** (degradation ledger + observability) — direct ancestors.
- **FR-063** (verify harness consuming `SOURCES`).
- No postmortem directly on point; PM-004 (NOAA station metadata) is the nearest in spirit
  (a source that *looks* valid but isn't) — relevant to the CONSTRAINT-015 "is null really
  handled" question.

---

## Recommended scope for Phase 2 (spec)

1. **Classify the 7** non-`sourceChain` `SOURCES` modules: single-source (logging + 015 audit
   only) vs multi-source-bypass (route runtime through `sourceChain`).
2. **Route confirmed multi-source modules** (`utilities` electric for sure) through
   `sourceChain` so runtime fallback records degradation — preserving FR-058 caching rules.
3. **Standardize swallow-site logging**: data-layer catch sites use the structured logger
   (or feed the ledger) instead of raw `console.error`.
4. **CONSTRAINT-015 audit** of each `return null` consumer; fix any silent empty sections
   with a named actionable fallback.
5. Tests for each touched module incl. Jeffersonville IN + a degradation-recorded assertion.

**Open question for Nathan (Phase 2 decision):** scope all 7 modules in one FR, or land
`utilities` as a vertical-slice pilot first (prove the sourceChain-routing + caching-parity
pattern on one module), then fan out? Pilot-first is lower risk and matches the FR-058/FR-065
incremental style.

---

## Phase 1 exit

No code changed. Findings above supersede the hand-off's "swallow-site sweep" framing.
Ready for Phase 2 (Specification) on Nathan's go.
