# FR-057 Costs L3/L4 Deep Dive — Implementation Plan

**Goal:** Add L3 (2-tab deep dive: Long-Term View + Verify Before Closing) and L4 (extended carrying cost table at 6 price points) to the Property Costs & Market chapter — the final chapter in the depth slider rollout.

**Architecture:** Add `buildCostsLongTermTab`, `buildCostsVerifyTab`, `buildCostsDeepDiveHTML`, `buildCostsResearchHTML` to `src/modules/costs/template.js`. The 9th arg (`fullHTML`) to `renderChapterCard` is currently `null` in the Costs chapter — no append needed, simply replace with `fullHTML || null`.

**Data shapes:**
- `p.state`: string (e.g., "KY")
- `p.taxRate`: number as percent (e.g., 0.86)
- `p.insuranceYear`: annual premium calibrated to $300k home
- `p.utilitiesMo`: monthly utilities
- `p.homesteadNote`: string or null

---

## File Map

| File | Change |
|------|--------|
| `src/modules/costs/template.js` | Add 4 new functions; update `renderChapterCard` call |
| `public/report.css` | Add `.costs-deep-dive`, `.costs-deep-dive-label`, `.costs-longterm-stat-val` |
| `tests/modules/costs/template.test.js` | Add L3 and L4 describe blocks |

---

## Tasks (completed in single session)

- [x] Write failing L3 + L4 tests
- [x] Implement `buildCostsLongTermTab(p)` — 5/10/30yr horizon at $300k with maintenance reserve
- [x] Implement `buildCostsVerifyTab(p)` — 5-item pre-closing checklist
- [x] Implement `buildCostsResearchHTML(p)` — 6-price-point carrying cost table
- [x] Implement `buildCostsDeepDiveHTML(p)` — 2-tab container
- [x] Wire fullHTML into `buildPropertyDataHTML`
- [x] Add CSS (`.costs-deep-dive`, `.costs-deep-dive-label`, `.costs-longterm-stat-val`)
- [x] Run full test suite — 1,084 / 61 suites, 0 failures
- [x] Commit and push
