## FR-088 — Property Intelligence chapter → headless report contract (rollout #9)

Migrates the Property Intelligence chapter (soil + construction era/vintage) to the headless report
contract. **First non-located chapter** — findings designed bespoke from the `propIntel` logic output
(no `place{}` reuse). No schema change (stays `1.0`). **9 of 14 chapters**.

ADR-1 boundary: scope is `getPropertyIntelligence` output. The tax/insurance/utilities `propertyData` is
rendered by the costs module → future costs contract.

### Findings (`buildPropertyContract(propIntel, opts)`)
- **`construction-era`** (consider): `{value: medianYearBuilt, unit:'year_built'}`, tone `neutral` (factual
  median, not a quality judgment — CONSTRAINT-001). Census ACS.
- **`era-health-risks`** (check, caution): only when cautions present (older homes → lead/asbestos/…);
  inspection instruction fallback. Omitted for modern construction (template-faithful).
- **`soil-drainage`** (check): `tone = toneFromDrainageColor` (color consumed → dropped); `isHydric` forces
  caution + wetland note. USDA SDA. — **`soil-missing`** (check): SoilWeb url fallback (CONSTRAINT-015 floor).
- **`new-construction`** (cool): `{value: newConstructionPct, unit:'percent'}` — housing-stock fact
  (CONSTRAINT-002 safe).

### Constraints
- **CONSTRAINT-001/008** — no composite score; drainage color derives tone then is dropped. Test asserts no
  `color`/`drainagecl`/`muname`/`context`/`hydricrating` leak; `.strict()` enforces it.
- **CONSTRAINT-002** — housing-stock facts only, never demographic character.

### Tests (+13, +3 snapshots) — full suite **98 suites / 1800 tests green** (was 97/1787)
`tests/modules/property/contract.test.js`: schema-valid; era measure/tone; era-health-risks gating; drainage
tone-from-color (favorable green / caution red+hydric); soil-missing → SoilWeb url; new-construction
percent/cool; no score/grade/leaked-keys; per-address snapshots incl. **Jeffersonville IN**.

### ⚠️ Decision needed before walkability
Walkability emits a 0–100 composite `score` + graded category — a numerical quality rating CONSTRAINT-001
forbids; the schema has no `score` field. Needs a product call (recommend: surface only the underlying
destination counts as facts, drop the composite). Detailed in `summary.md`. Not started here.

### Docs
- `feature-requests/FR-088-property-contract/` (spec, plan, summary)
- Roadmap updated (rollout 9/14; non-located finding-design pattern established).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
