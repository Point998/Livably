## FR-083 — Cross-state filter for `findNearestPharmacy` (PM-006 fix)

Closes the **PM-006 / CONSTRAINT-006** gap in the **pharmacy** (Reachability) data path. Pharmacy
is named explicitly in CONSTRAINT-006, but `findNearestPharmacy` had no `originState` parameter and
never called `checkCrossState` — so a border address (Jeffersonville IN) could surface a Kentucky
pharmacy as "the nearest pharmacy" with no label. This was the last member of CONSTRAINT-006's named
list (school, hospital, urgent care, pharmacy) still unguarded.

### Approach
- New `finalizePharmacyRecord(record, originState)` applies `checkCrossState` to the **final**
  selected pharmacy, once, at the public `findNearestPharmacy` entry — covering the Google primary
  and OSM fallback uniformly, **per-address**.
- Policy mirrors the health safety tier (`finalizeSafetyRecord`): **warn, don't reject** — pharmacy
  is grouped with hospital/urgent care in the constraint and medication access is safety-adjacent, so
  the nearest pharmacy is always returned (CONSTRAINT-015) with a `crossStateWarning` + `crossStateNote`
  when out-of-state.
- Returns a **new** object on the cross-state branch — the FR-058 cell cache is never mutated, so two
  addresses sharing a border-straddling H3 cell each get the correct, independent determination.
- No-op when `originState` is empty (preserves `compareBuilder`).
- Template surfaces the note in both narrative branches; call site threads `originState`.

### Tests (+9) — full suite **93 suites / 1741 tests green** (1732 → +9)
- `data.test.js` (+4): flagged / not-flagged / no-op / **cache-not-poisoned-across-states**.
- `template.test.js` (+3): note rendered in drive-time + OSM branches; absent in-state.
- `jeffersonville-in.test.js` (+2): IN-origin KY pharmacy flagged, IN pharmacy clean.

### Docs
- `docs/postmortems/PM-006-cross-state-pharmacy.md`
- `feature-requests/FR-083-pharmacy-crossstate-filter/` (spec, plan, summary)

Reinforces CONSTRAINT-014. Grocery/gas/coffee remain deliberately out of scope.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
