## FR-084 — Safety chapter → headless report contract (rollout #5)

Migrates the **safety** chapter (police/fire emergency response + ISO/crime research) to the headless
report contract, following the proven per-module `contract.js` pattern (utilities, community, health,
schools). Reuses the `place{}` primitive — **no schema change** (stays `1.0`). **5 of 14 chapters** now
on the contract.

### Mapping
- **`police-response` / `fire-response`** (consider): `place` + `{value, unit:'response_minutes'}` measure,
  `tone` derived via `responseTone` (≤8 favorable / ≤12 neutral / >12 caution — faithful to the template's
  narrative tiers). Provenance `modeled: true` (estimate = distance ÷ dispatch speed). Missing station →
  `*-response-missing` (check/caution + instruction fallback).
- **`iso-ppc`** (check, always): actionable instruction to pull the address-specific ISO PPC rating.
- **`crime-research`** (check, always): pointer only, url fallback to a crime map.

### Constraint handling
- **CONSTRAINT-001/008** — input stations carry a graded `response.category` (`Excellent/Good/Fair/Delayed`
  + color). The builder **drops it** and derives `tone`. Tests assert no `"color"`/`"category"` in the
  serialized contract; `.strict()` enforces it structurally.
- **CONSTRAINT-002** — crime finding has no measure/comparison; never characterizes the area.
- **CONSTRAINT-015** — missing stations + always-on iso/crime carry actionable fallbacks; response measures
  flagged `modeled`.

### Tests (+13, +3 snapshots) — full suite **94 suites / 1754 tests green** (was 93/1741)
`tests/modules/safety/contract.test.js`: schema-valid; place+measure+modeled; tone tiers (both stations);
missing-station fallbacks; always-on iso/crime; no score/grade/color/category; provenance dedupe;
per-address snapshots incl. **Jeffersonville IN** (CONSTRAINT-011).

### Docs
- `feature-requests/FR-084-safety-contract/` (spec, plan, summary)
- Roadmap updated (contract rollout 5/14; next located-facility = reachability).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
