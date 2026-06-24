## FR-091 — Growth & Development chapter → headless report contract (rollout #12)

Migrates Growth & Development (building-permit trend + nearby commercial development + named project
pipeline) to the contract. No schema change (stays `1.0`). **12 of 14 chapters.**

### Findings (`buildGrowthContract(growth, opts)`)
- **`permit-trend`** (consider, neutral): `{value: current, unit:'building_permits'}`; YoY change + trend in
  copy. Census BPS. Absent → `permit-trend-missing` (check) + county-planning instruction fallback.
- **`development-activity`** (cool, neutral): `{value: count, unit:'count'}`; names+labels in copy;
  Google Places / OpenStreetMap (`modeled:true`) by source.
- **`named-projects`** (cool, neutral): `{value: count, unit:'count'}`; project names + status. Google News.

### CONSTRAINT-001 trap (roadmap-flagged), handled
Growth is value-neutral for a buyer (rising permits = appreciation *or* construction noise). The permit
`trend` is a **directional fact, not a quality score** — **all growth findings use tone `neutral`**; none
implies growth is good/bad. Trend direction lives in `defaultCopy`. A test asserts all-neutral and no
`trend`/`label` leak. `newConstruction` omitted (property owns it — FR-088; test asserts no `newConstructionPct`).

### Tests (+12, +3 snapshots) — full suite **101 suites / 1839 tests green** (was 100/1827)
`tests/modules/growth/contract.test.js`: permit-trend measure/copy; missing→instruction fallback;
development-activity count + OSM modeled:true; named-projects; newConstruction ignored; all-neutral/no-leak;
per-address snapshots incl. **Jeffersonville IN** (declining).

### Docs
- `feature-requests/FR-091-growth-contract/` (spec, summary)
- Roadmap updated (rollout 12/14; remaining: garden, costs, climate + deferred ambiance).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
