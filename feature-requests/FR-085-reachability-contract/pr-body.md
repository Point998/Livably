## FR-085 — Reachability chapter → headless report contract (rollout #6)

Migrates the reachability "Daily Conveniences" (**grocery / pharmacy / gas station**) to the headless
report contract, following the proven per-module `contract.js` pattern. Reuses the `place{}` primitive —
**no schema change** (stays `1.0`). **6 of 14 chapters** now on the contract.

ADR-1 boundary: reachability owns grocery/pharmacy/gas only — civic items (recreation), highway (access),
and hospital/ER (health) are separate contracts.

### Mapping (shared `destFinding` helper)
- **`nearest-grocery` / `nearest-pharmacy` / `nearest-gas`** (consider):
  - Google → `place` + `{value: driveTimeMinutes, unit:'drive_minutes'}`, `tone = driveTone`
    (≤10 favorable / ≤20 neutral / >20 caution), `Google Places` `modeled:false`.
  - OSM straight-line → `{value: distanceMiles, unit:'straight_line_miles'}`, `modeled:true`,
    `OpenStreetMap`, honest caveat (`address:null` coerced for `PlaceSchema`).
  - **Caution overrides** (tone:caution + note): grocery `coherenceWarning` (CONSTRAINT-010), pharmacy
    `crossStateWarning` (FR-083) — a 10-min KY pharmacy for a Jeffersonville IN origin reads `caution`.
  - Missing → `nearest-{x}-missing` (check) + Google Maps url fallback (CONSTRAINT-015).

### Constraint handling
- **CONSTRAINT-001/008** — no score/grade/color; tone derived. A test asserts no internal keys
  (`color`/`bandRung`/`coherenceWarning`/`proximitySource`/`location`) leak; `.strict()` enforces it.
- **FR-058** — lifestyle times are the cell-centroid minutes the template already renders (documented
  sub-block approximation; the safety tier is the exact-recompute one). Surfaced as a real `drive_minutes`
  measure; re-banding out of scope.

### Tests (+13, +3 snapshots) — full suite **95 suites / 1767 tests green** (was 94/1754)
`tests/modules/reachability/contract.test.js`: schema-valid; grocery[0] place+measure+modeled; tone tiers;
coherence→caution; cross-state pharmacy→caution; OSM measure + null-address coercion; missing→url fallback;
no leaked keys; provenance dedupe; per-address snapshots incl. **Jeffersonville IN**.

### Docs
- `feature-requests/FR-085-reachability-contract/` (spec, plan, summary)
- Roadmap updated (rollout 6/14; next located-facility = recreation / access).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
