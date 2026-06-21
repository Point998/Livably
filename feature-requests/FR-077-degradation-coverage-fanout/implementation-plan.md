# FR-077 — Implementation Plan

**Phase 3 — Planning. No code changes in this phase.**
Date: 2026-06-21

## Tasks (data → template → tests → ship)

**T1 — community/data.js logging.**
- Import `logError` from `../../logger` (match the per-module convention).
- Replace `console.error('[Demographics]', err.message)` with
  `logError('getDemographics', \`${lat},${lng}\`, err)` (use whatever location identifier the
  function already has in scope; confirm during impl).

**T2 — community/template.js income 015 fix.**
- Line ~281: replace the `: '<div class="prem-demo-sub">Income data unavailable</div>'` branch
  with an actionable fallback that names a source the buyer can act on, reusing existing classes
  (no inline styles). Draft copy:
  `Income data wasn't returned for this tract — look it up at <a href="https://data.census.gov" target="_blank" rel="noopener noreferrer">data.census.gov</a>.`
  - CONSTRAINT-002: no economic-class characterization; just the source pointer.
  - Keep it inside the existing `prem-demo-sub` element / income card structure.

**T3 — Tests.**
- community template test: assert the income-null branch contains `data.census.gov` and an
  `<a` tag (actionable), and does NOT contain the bare "Income data unavailable" string; assert
  the median-present branch still renders the money figure.
- community data test: assert `getDemographics` returns null on fetch failure without throwing
  (logging is fire-and-forget); confirm no `console.error` reliance. Reuse existing mock style.
- Confirm a Jeffersonville IN path is exercised (existing integration or add a community case).

**T4 — Verify & document.**
- `npx jest` — full suite green.
- summary.md: changes + the 015 audit table (5 PASS/N-A + 1 fix), AC check.

**T5 — Ship.** Branch `FR-077-degradation-coverage-fanout`, commit, push, PR; roadmap update
folded in.

## Risks
| # | Risk | Mitigation |
|---|---|---|
| R1 | `getDemographics` may not have `lat,lng` in scope at the catch. | Confirm during impl; pass whatever locator exists (city/state or coords) — `logError`'s address slot is free-form. |
| R2 | Template test brittleness on exact copy. | Assert on stable substrings (`data.census.gov`, `<a`), not full sentence. |
| R3 | Income card layout: a link in a small card. | Acceptable per CONSTRAINT-015 (actionable > aesthetic); reuse `prem-demo-sub`, no new styles. |

## Phase 3 exit
No code changed. Execute on approval (proceeding — scope already approved by Nathan).
