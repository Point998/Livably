## FR-086 — Recreation chapter → headless report contract (rollout #7)

Migrates the recreation amenities (**park / coffee shop / public library / recreation center / post
office**) to the headless report contract, following the proven per-module `contract.js` pattern. Reuses
`place{}` — **no schema change** (stays `1.0`). **7 of 14 chapters** now on the contract.

ADR-1 boundary: recreation owns these 5 amenities only. `elementarySchool` (rendered in the same template
card) is schools-module data, already on the contract — excluded here.

### Mapping (shared `amenityFinding` helper)
- One finding per **present** amenity, all bucket **`cool`**:
  - Google → `place` + `{value: driveTimeMinutes, unit:'drive_minutes'}`, `tone = amenityTone`
    (≤10 favorable, else neutral — **never caution**), `Google Places` `modeled:false`.
  - OSM straight-line → `{value: distanceMiles, unit:'straight_line_miles'}`, `modeled:true`,
    `OpenStreetMap`, honest caveat (`address:null` coerced for `PlaceSchema`).
- **Absent amenities are omitted** (no `*-missing` finding) — faithful to the template; a missing
  discretionary amenity isn't a decision gap to "check" (cf. FR-085's daily essentials).

### Why it differs from FR-085
Recreation amenities are "Cool Things to Know," not daily essentials: bucket `cool` (not `consider`),
never `caution` (a distant park isn't a risk — CONSTRAINT-001), and absent = omitted (not flagged).

### Tests (+11, +3 snapshots) — full suite **96 suites / 1778 tests green** (was 95/1767)
`tests/modules/recreation/contract.test.js`: schema-valid; 5 cool findings; place+measure+modeled;
`amenityTone` favorable/neutral (never caution); OSM measure + null-address coercion; absent amenity
omitted; no score/grade/leaked-keys; provenance dedupe; per-address snapshots incl. **Jeffersonville IN**.

### Docs
- `feature-requests/FR-086-recreation-contract/` (spec, plan, summary)
- Roadmap updated (rollout 7/14; next located-facility = access/highway).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
