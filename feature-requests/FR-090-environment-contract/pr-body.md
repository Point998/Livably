## FR-090 — Environment chapter → headless report contract (rollout #11)

Migrates the environmental health & safety data (`getEnvironmentalData`, sensory module) to the contract.
No schema change (stays `1.0`). **11 of 14 chapters.** Sensory **ambiance** items (airports/rail/light) are
a documented deferred follow-on.

### Findings (`buildEnvironmentContract(environment, opts)`)
- **`flood-risk`** (check): FEMA zone, tone from risk; zone+insurance in copy; absent → FEMA MSC url.
- **`air-quality`** (consider): `{value: aqi, unit:'aqi'}`, tone from AQI category color.
- **`road-noise`** (consider): `{value: dnl, unit:'dnl_db'}`, `modeled:true` when estimated.
- **`water-quality`** (check): `{value: violations.length, unit:'violation_count'}`, caution when >0.
- **`radon`** (check): EPA zone tone (1→caution/3→favorable), `modeled:true` (state-level) + test instruction.
- **`hazard-proximity`** (check): EPA EJSCREEN **hazard proximity only**, caution when flagged, EPA ECHO url.

### Principle established (for remaining chapters)
**External standard indices (EPA AQI, FEMA flood zone, EPA radon/EJSCREEN, FHWA DNL) are factual data, not
Livably composite scores** — surfaced as measures with tone from their published category (graded
label/color dropped). Differs from walkability's Livably-computed composite (FR-089, banned by CONSTRAINT-001).

### Constraints
- **CONSTRAINT-001/008** — external indices as facts; category label/color dropped. Test asserts no
  `color`/`category` leak.
- **CONSTRAINT-002 (Fair Housing)** — EJSCREEN = hazard proximity only; a test asserts no
  `minority`/`income`/`race`/`demographic`/`poverty` terms in the serialized contract.
- **CONSTRAINT-015** — url fallbacks (flood/air/water), radon always recommends a test, hazard → EPA ECHO.

### Tests (+13, +3 snapshots) — full suite **100 suites / 1827 tests green** (was 99/1814)
`tests/modules/sensory/contract.test.js`: tone derivations across all 6; modeled flags; no-demographics
assertion; no score/color/category leak; per-address snapshots incl. **Jeffersonville IN** (flood+hazard).

### Docs
- `feature-requests/FR-090-environment-contract/` (spec, summary)
- Roadmap updated (rollout 11/14; ambiance deferred; external-index principle documented).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
