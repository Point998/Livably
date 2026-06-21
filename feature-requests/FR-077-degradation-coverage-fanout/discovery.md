# FR-077 — Degradation Coverage Fan-Out (remaining 6 modules)

**Phase 1 — Discovery (read-only). No code changes in this phase.**
Date: 2026-06-21
Modules examined: health, community, access, schools, safety, garden

---

## Headline finding (overturns the FR-076 fan-out premise)

**None of the 6 modules has a utilities-style multi-source runtime fallback.** The high-value
part of the FR-076 pilot — routing a hand-rolled `A() || B()` source-fallback chain through
`sourceChain` so a silent runtime fallback becomes a recorded degradation event — **does not
apply to any of these 6.** There is no silent-fallback bug here to fix.

Every `||` in these files is a defensive default (`results || []`, `value || null`, `|| 1`),
not a source fallback. The multi-entry `SOURCES` arrays (health=4, garden=3) are **distinct
datums**, not fallback chains for one datum.

---

## Per-module classification

| Module | Runtime sources | Pattern | Fallback to route? | Logging | 015 audit |
|---|---|---|---|---|---|
| **health** | 4 distinct datums (hospital, urgent care, CMS type, primary-care count) | independent single-source each | **No** | already `logError` ✅ | needed |
| **community** | 1 (Census ACS5) | single-source | **No** | 1 `console.error('[Demographics]')` → swap | needed |
| **access** | 1 (Google geocode+DM highway) | single-source; bare `catch{ return null }` (intentional per CONSTRAINT-005) | **No** | silent by design, no console.error | needed |
| **schools** | 1 (Google Places school) | single-source; **no catch blocks** in data.js | **No** | none to change | needed |
| **safety** | 1 (Google Places police+fire) | single-source via `Promise.allSettled`; `catch {}` only on drive-time degrade | **No** | no console.error | needed |
| **garden** | 13 independent datums via `Promise.allSettled` + `val(r, fallback)` | multi-datum, each single-source, already resilient | **No** | no console.error swallow | needed |

### Detail
- **garden** (`getGardenData`, data.js:105–154): `Promise.allSettled` over 13 iNat/PHZM/USGS
  calls, each degrading to `[]`/`null` via `val()`. This is *already* the resilient pattern —
  no chain, nothing to route.
- **health**: the 4 `SOURCES` are hospital / urgent care / CMS type / primary-care count — four
  different facts, fetched independently. Catch sites already use `logError` (FR-prior).
- **access**: `catch { return null }` is deliberate (highway geocoding strategy, CONSTRAINT-005);
  silent by design, not a swallow bug.
- **schools**: no `catch` in data.js at all; single Google Places search (+ CONSTRAINT-006
  same-state rule lives in validate.js).
- **safety**: one Google Places call returning police+fire; `allSettled` + null-guards.
- **community**: the only genuine logging-consistency item — one
  `console.error('[Demographics]')` swallow site (data.js:125–127).

---

## What actually remains (much smaller than "fan out the pattern")

1. **community**: swap 1 `console.error` → `logError` (consistency with the structured logger /
   FR-028 error-memory). ~1 line.
2. **CONSTRAINT-015 audit** across all 6: confirm each null-datum path renders a *named,
   actionable* fallback in `template.js`, not a silent empty section. This is the real value of
   the fan-out — verifying graceful degradation is honest across these chapters. Fix any gaps
   found.

There is **no `sourceChain` routing work** for any of the 6, because none has a fallback to
record.

---

## The open design question (Nathan's call — see below)

Single-source modules record **no** degradation event when their *sole* source hard-fails
(`sourceChain` is the only thing that calls `recordDegradation`, and these don't use it). So a
total failure of, say, the Census demographics fetch is invisible to the FR-068 ledger (though
still visible via `logError` + the degraded report output).

Two ways to read that:

- **(A) Minimal / honest (recommended):** these modules have no silent-fallback bug; the FR-076
  value prop doesn't apply. Fan-out = the community logging swap + the 6-module 015 audit. Low
  effort, real-but-modest value (consistency + verified graceful degradation). Don't add
  `sourceChain` where there's nothing to fall back to.
- **(B) Uniform ledger coverage:** wrap each report-degrading single source in a 1-element
  `sourceChain` so a hard failure records an `exhausted` event — uniform "this report ran
  degraded" visibility across *all* modules. More work (touch 6 modules), debatable incremental
  value since single-source failures are already logged and visibly degrade the report. Risks
  adding ceremony for little signal.

---

## Risks / notes
- CONSTRAINT-011: any module touched needs a test + Jeffersonville IN coverage. Under (A), only
  community's data.js changes (the rest is audit-only), keeping the test surface small.
- CONSTRAINT-005 (access) and CONSTRAINT-006 (schools): do not disturb the intentional silent /
  same-state behaviors during the 015 audit.
- No postmortem implicated.

## Phase 1 exit
No code changed. The fan-out premise (6 more modules with the utilities bug) is **disproven** —
none has a multi-source runtime fallback. Recommend pausing for a scope decision (A vs B) before
Phase 2.
