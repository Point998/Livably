## FR-089 — Walkability chapter → headless report contract (rollout #10, counts-only)

Migrates walkability to the contract, resolving the **CONSTRAINT-001** score conflict flagged in FR-088
per **Nathan's decision: surface destination counts only, drop the composite 0–100 score + graded category.**
No schema change (stays `1.0`). **10 of 14 chapters.**

### Approach
- **Data-layer (additive):** Google + OSM walkability outputs now expose a `counts` map
  `{ Grocery, Dining, Transit, Park, Pharmacy }` (true per-category counts, previously discarded). `score`/
  `category` are **kept for the SSR template**; the contract reads `counts`, never `score`.
- **Contract:** one **`walkable-{category}`** finding per category with `count > 0` (cool/favorable;
  `{value: count, unit:'places_within_walk'}`; nearest place + walk minutes in `defaultCopy`). Car-dependent
  / unavailable → a single **`walkability-pointer`** (check) with a Walk Score url fallback (CONSTRAINT-015).
  Google `modeled:false`; OSM `modeled:true`.

### CONSTRAINT-001 resolution
The composite `score` and graded `category` are **never read or emitted** — a test asserts no
`"score"`/`"category"`/`"color"`/`"grade"` in the serialized contract, and `.strict()` enforces it. The
signal survives as factual counts, not a banned quality rating.

### Tests (+15, +3 snapshots) — full suite **99 suites / 1814 tests green** (was 98/1800)
`data.test.js` (+2): `counts` map (Google + OSM). `contract.test.js` (new, 13): per-category count findings;
count-0 omitted; nearest→defaultCopy; car-dependent/unavailable → Walk Score pointer; **no score/category
leak**; OSM modeled:true; per-address snapshots incl. **Jeffersonville IN**.

### Docs
- `feature-requests/FR-089-walkability-contract/` (spec, plan(in spec), summary)
- Roadmap updated (rollout 10/14; next clean candidate = environment).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
