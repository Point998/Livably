# FR-077 — Spec (Degradation Coverage Fan-Out → logging + 015 audit)

**Phase 2 — Specification. No code changes in this phase.**
Date: 2026-06-21
Scope decision (Nathan): **minimal — logging swap + CONSTRAINT-015 audit.** No `sourceChain`
routing (discovery proved none of the 6 has a multi-source runtime fallback).

---

## Problem

FR-076 fanned out as planned, but discovery disproved the premise: of the 6 remaining
SOURCES-but-no-runtime-`sourceChain` modules, **none has a utilities-style silent `||` fallback**.
They are single-source or multi-datum-single-source-each, mostly already resilient
(`Promise.allSettled` + defensive defaults). So the high-value routing work does not apply.

What does remain, found in the audit:
1. **Logging inconsistency** — `community/data.js` has one `console.error('[Demographics]')`
   swallow site that bypasses the structured logger (the other 5 modules already use `logError`
   or have no console.error swallow sites).
2. **One CONSTRAINT-015 gap** — `community/template.js:281` renders the generic message
   `"Income data unavailable"` with no actionable alternative when `d.income.median` is null but
   the tract otherwise resolved. CONSTRAINT-015 explicitly prohibits a generic "data not
   available" message without a specific actionable alternative.

## CONSTRAINT-015 audit result (the substance of this FR)

| Module | Result | Evidence |
|---|---|---|
| health | PASS | urgent-care → Solv Health + Urgent Care Association; CMS type → CMS Care Compare; primary care → "contact your insurer". `if(!hospital&&!emergency) return ''` = omission. |
| community | **FIX** | income-null → generic "Income data unavailable" (no action). Chapter-level `if(!d) return ''` = omission (acceptable). |
| access | N/A | no template.js; highway output renders via the Reachability chapter (already resilient). |
| schools | PASS | GreatSchools search + NCES School Search links on empty/missing. `if(!schools) return ''` = omission. |
| safety | PASS | crime-prep section (CrimeMapping.com + SpotCrime.com) always renders with actionable links regardless of station data. |
| garden | PASS | hardiness-null → USDA Plant Hardiness Zone Map; urban soil → geotechnical/seller. `Promise.allSettled` per-datum degrade. |

Borderline-but-acceptable (no change): schools "No public schools found within search radius"
and safety "No <x> station found nearby" — contextual sub-messages inside chapters that already
carry actionable fallbacks elsewhere; not standalone empty sections.

---

## Scope

### In scope
1. `community/data.js`: `console.error('[Demographics]', err.message)` → `logError('getDemographics', …, err)`.
2. `community/template.js:281`: replace `"Income data unavailable"` with an actionable fallback
   (a named source the buyer can use — data.census.gov for this tract).

### Out of scope
- Any `sourceChain` routing (nothing to fall back to).
- The other 5 modules' code (audit = PASS / N/A).
- Uniform 1-element-sourceChain ledger coverage (option B; not chosen).

---

## Inputs / Outputs / Edge cases

- **community demographics fetch fails** (`getDemographics` catch) → returns null, logs via the
  structured logger (was `console.error`). Behaviour otherwise identical.
- **tract resolves but `income.median` is null** → income card renders an actionable line
  pointing to data.census.gov, not "Income data unavailable". Other demographic cards unchanged.
- **`d.income.median` present** → unchanged (renders the money figure + badge).

## Acceptance criteria
- [ ] AC-1 `community/data.js` has no `console.error`; the demographics catch uses `logError`.
- [ ] AC-2 The income card, when `median` is null, renders a named actionable source
  (data.census.gov), not a bare "unavailable" message. (CONSTRAINT-015)
- [ ] AC-3 When `median` is present, income card output is unchanged.
- [ ] AC-4 No inline styles introduced; reuse existing semantic classes (CONSTRAINT-008).
- [ ] AC-5 Tests cover the income-null fallback render and the present case; full suite green;
  Jeffersonville IN path exercised (CONSTRAINT-011).
- [ ] AC-6 Audit recorded (this doc + summary) — the 5 PASS/N/A modules documented, not silently
  skipped.

## Constraints in play
CONSTRAINT-015 (actionable fallback), -008/-009 (no inline styles / no design in data),
-011 (tests + Jeffersonville), -002 (Fair Housing — income compared to national median only;
the fallback copy must not characterize the area's economic class).

## Phase 2 exit
No code changed. Plan follows.
