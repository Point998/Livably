# FR-057 Costs L3/L4 Deep Dive — Implementation Summary

## What Was Built

### L3 — Two-Tab Deep Dive
Added to `src/modules/costs/template.js`:
- `buildCostsLongTermTab(p)` — Long-Term View: 5/10/30-year carrying cost estimates at $300k reference price, including property tax, insurance, utilities, and a 1% maintenance reserve (not shown in L2). Tax framing adjusts for high/low/average rate states. Uses `.growth-permit-stat-row` / `.growth-permit-stat` CSS for the 3-stat grid (already in report.css from FR-054).
- `buildCostsVerifyTab(p)` — Verify Before Closing: 5-item actionable checklist for translating state averages into real numbers — county assessor lookup, insurance quotes, utility bill history, HOA disclosure, maintenance reserve calibration. Reuses `.safety-prep-item` CSS from FR-053.
- `buildCostsDeepDiveHTML(p)` — 2-tab container using existing `climate-tab` / `climate-tab-panel` system, prefixed `cstab-` / `csbtn-` for unique aria IDs.

### L4 — Extended Carrying Cost Table
- `buildCostsResearchHTML(p)` — full carrying cost table at 6 price points: $200k, $250k, $300k, $350k, $400k, $500k. Columns: Price | Tax/mo | Insurance/mo | Utilities/mo | Total/mo. Uses `climate-data-table` CSS. Absent if `p` is null.

### Wiring
The Costs chapter previously passed `null` as the 9th arg to `renderChapterCard` (unlike walkability/sensory which had existing content to append to). L3/L4 simply replaces that null:
```js
const fullHTML = [l3HTML, l4HTML].filter(Boolean).join('');
return renderChapterCard(..., fullHTML || null, ...);
```

### CSS
Added 3 new rules to `public/report.css`:
- `.costs-deep-dive` — margin-top container
- `.costs-deep-dive-label` — section heading
- `.costs-longterm-stat-val` — stat numbers in costs chapter color (`var(--ch-costs)`)

All item-level patterns reuse existing CSS (`.safety-prep-item` from FR-053, `growth-permit-stat-*` from FR-054).

## Tests
17 new tests across 2 new describe blocks in `tests/modules/costs/template.test.js`.
Full suite: 1,084 tests / 61 suites — 0 failures.

## Milestone
FR-057 completes the L3/L4 depth slider rollout. All 14 chapters now have full depth slider support:
- L1: Glance bar
- L2: Overview (narrative + data)
- L3: Deep Read (2-tab chapter-specific dive)
- L4: Research (data tables)

## Constraints Verified
- CONSTRAINT-008: no inline styles — passes
- CONSTRAINT-001: no numeric score/rating — passes
