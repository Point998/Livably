## FR-087 — Access (highway) chapter → headless report contract (rollout #8)

Migrates the access chapter (nearest interstate on-ramp — the "Getting Around" narrative) to the headless
report contract. Reuses `place{}` — **no schema change** (stays `1.0`). **8 of 14 chapters** —
**completes the located-facility rollout.**

### Mapping
- Single finding **`highway-access`** (bucket `consider`): `place{name,address}` +
  `{value: driveTimeMinutes, unit:'drive_minutes'}`, `tone = driveTone` (≤10 favorable / ≤20 neutral /
  >20 caution), `Google geocoding + Distance Matrix` `modeled:false`. `highwayRamp.note` ("Also within
  20 minutes: …") → transitional `defaultCopy`.
- **Returns `null` when `highwayRamp` is absent** — faithful to the template (which omits "Getting Around"
  when there's no highway); omission, not an empty render, satisfies CONSTRAINT-015.

### Constraint handling
- **CONSTRAINT-005/PM-002** — highway is the upstream geocoding-strategy record; this layer only serializes.
- **CONSTRAINT-001/008** — no score/grade/color; tone derived. Test asserts no `color`/`location`/`note`
  keys leak (claim built fresh; `note` read into `defaultCopy` only).
- **CONSTRAINT-007** — a far highway (>20 min, rural) renders `caution` + test-the-drive framing, not a
  failure message (Harlan snapshot).

### Tests (+9, +3 snapshots) — full suite **97 suites / 1787 tests green** (was 96/1778)
`tests/modules/access/contract.test.js`: null-on-absent; schema-valid single finding; place+measure+
consider+modeled; `driveTone` tiers; note→defaultCopy; no score/grade/leaked-keys; per-address snapshots
incl. **Jeffersonville IN**.

### Docs
- `feature-requests/FR-087-access-contract/` (spec, plan, summary)
- Roadmap updated (rollout 8/14; **located-facility rollout complete** — remaining chapters are non-located,
  bespoke finding design).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
