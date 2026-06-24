## FR-092 — Garden / "What Will Grow" chapter → headless report contract (rollout #13)

Migrates the garden / nature chapter (hardiness zone, native/invasive flora, local fauna, pollinator
habitat, microclimate) to the contract. No schema change (stays `1.0`). **13 of 14 chapters.**

### Findings (`buildGardenContract(garden, opts)`) — all `cool` except invasive (`check`), emitted when present
- **`hardiness-zone`** (neutral): `{value: frost.days, unit:'growing_season_days'}`; zone + frost in copy.
- **`native-plants` / `local-birds` / `butterflies`** (favorable): `{value: count, unit:'species'}` + examples.
- **`local-wildlife`** (neutral): species count; deer/garden note when deer present.
- **`invasive-plants`** (check, neutral): count + gardening heads-up.
- **`monarch-corridor` / `firefly-habitat`** (favorable): when in range; `modeled:true` (state-range models).
- **`microclimate`** (neutral): `{value: elevationFt, unit:'feet'}` + solar/shadow note.

### Constraints
- **CONSTRAINT-001/008** — species counts are observational facts (iNaturalist research-grade), not quality
  scores; favorable = amenity signal (cf. recreation). Species `sci` read into copy, not emitted (test asserts
  no `sci`/`color` leak).
- **Honest provenance** — monarch/firefly = state-range models (`modeled:true`); counts/zone/elevation measured.
- **CONSTRAINT-015** — discretionary nature info; absent data omitted (no empty section).

### Tests (+13, +3 snapshots) — full suite **102 suites / 1852 tests green** (was 101/1839)
`tests/modules/garden/contract.test.js`: hardiness measure; species counts; wildlife deer-note; invasive
bucket; monarch/firefly gating + modeled; microclimate; empty-arrays omit; no score/leak; per-address
snapshots incl. **Bozeman MT** (different zone) and **Jeffersonville IN**.

### Docs
- `feature-requests/FR-092-garden-contract/` (spec, summary)
- Roadmap updated (rollout 13/14; remaining: costs, climate + deferred ambiance).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
