# FR-057 — Costs L3/L4 Deep Dive

## Goal
Add L3 (2-tab deep dive) and L4 (extended carrying cost table) to the Property Costs & Market chapter, completing the depth slider rollout for all 14 chapters.

## Module
`src/modules/costs/template.js`

## Input Data Shape
```js
{
  state: string,           // e.g., "KY"
  taxRate: number,         // effective rate as percent, e.g., 0.86
  insuranceYear: number,   // annual premium calibrated to $300k home, e.g., 1800
  utilitiesMo: number,     // monthly utilities, e.g., 180
  homesteadNote: string|null
}
```

## Key Difference from Other Chapters
The Costs chapter currently passes `null` as the 9th arg (`fullHTML`) to `renderChapterCard`. There is NO existing `fullHTML` content to preserve — L3/L4 simply replaces the null, no append needed.

## L3 — Two-Tab Deep Dive

### Tab 1: "Long-Term View"
Calculates and displays estimated carrying costs over 5, 10, and 30 year horizons at a $300k reference price. Includes a 1% maintenance reserve (not shown in L2 carrying cost table). Shows per-component annual breakdown and state-specific tax framing (high/low/average). The L2 carries month-level detail; L3 adds the horizon view.

Reference price: $300k (matches the glance bar, consistent UX)
Components: taxYear, insYear, utilYear, maintYear (1% of $300k)
Display: 3-stat grid using `.growth-permit-stat-row` / `.growth-permit-stat` reuse + new `.costs-longterm-stat-val` for chapter color

### Tab 2: "Verify Before Closing"
5-item actionable checklist for turning state averages into real numbers before closing:
1. 🏛️ County assessor — look up actual parcel tax history
2. 🛡️ Insurance quotes — get 3+ real quotes before closing
3. 🔌 Utility bills — request 12 months from seller
4. 🏘️ HOA disclosure — if applicable, full package before closing
5. 🔧 Maintenance reserve adjustment — calibrate to home age from inspection report

Reuses `.safety-prep-item` CSS (from FR-053).

## L4 — Extended Carrying Cost Table
Full table at 6 price points: $200k, $250k, $300k, $350k, $400k, $500k.
Columns: Price | Tax/mo | Insurance/mo | Utilities/mo | Total/mo

The L2 shows only $300k and $400k. L4 gives the full reference range buyers at different price points can use.

Uses `climate-data-table` CSS (already global).

## CSS Additions
- `.costs-deep-dive` — margin-top container
- `.costs-deep-dive-label` — section heading (same pattern as other chapters)
- `.costs-longterm-stat-val` — big numbers in costs chapter color (`var(--ch-costs)`)

Location: after `.prem-homestead-note` (last rule in costs section, currently end of file).

## Acceptance Criteria
- [ ] All 5 test addresses render without error
- [ ] "Long-Term View" tab shows 5yr/10yr/30yr estimates
- [ ] Maintenance reserve included in long-term calculation
- [ ] "Verify Before Closing" tab shows 5-item checklist
- [ ] L4 shows 6 price points from $200k to $500k
- [ ] Existing body content (carrying table, narrative) unaffected
- [ ] CONSTRAINT-008: no inline styles
- [ ] CONSTRAINT-001: no numeric rating/score
- [ ] All existing tests still pass
- [ ] New tests cover L3 and L4
