# FR-081 — Schools chapter → headless report contract

*Rollout #3 of the headless contract (after FR-078 utilities, FR-079 community, FR-080 health).*
**Status:** Spec · **Module:** `src/modules/schools` · **Date:** 2026-06-23

## Goal

Migrate the **schools** chapter into a `ChapterContract`, wired additively into the
report envelope. Same pattern as FR-080: per-module `contract.js` exporting
`buildSchoolsContract(input, opts)` → `safeBuild`, plus a contract test with
per-address snapshots incl. Jeffersonville. Reuses the FR-080 `ClaimSchema.place`
located-facility primitive (no schema change needed).

## Input

The chapter's data is `chapters.schools` from `getSchoolRatings()` (`src/chapters.js`):

```js
{
  public:  [ { level: 'Elementary'|'Middle'|'High', name, address, distanceMiles: "1.2", driveTimeMinutes: Number|null } | null ],  // ≤3
  private: [ { name, address, distanceMiles: "2.4" } ],  // ≤5, distance-sorted
} // or null
```

Builder signature: `buildSchoolsContract(schools, opts)` where `opts = { asOf?, degraded? }`.
Returns null when `schools` is null or has no public/private entries (matches
utilities/community/health: null input → chapter omitted from envelope).

## Findings

All three-bucket framing only (CONSTRAINT-001 — the data carries **no ratings/scores**;
the contract surfaces none). Tone derived from drive-time tiers, never a color.

| id | when | bucket | tone | claim |
|----|------|--------|------|-------|
| `assigned-school` | any school data present | check | caution | subject "Assigned school zone", measure null, place null; `fallbackAction` = instruction (call district) — the chapter's headline caveat: nearest ≠ assigned |
| `nearest-public-{level}` | each non-null public entry | consider | ≤10 favorable / 11–20 neutral / >20 caution (drive min); neutral if no drive time | subject `Nearest public {level} school`, `place {name,address}`, measure: `{value: driveTimeMinutes, unit:'drive_minutes'}` or `{value: miles, unit:'miles'}` when drive time null |
| `private-school-{i}` | each private entry | cool | neutral | subject "Nearby private school", `place {name,address}`, measure `{value: miles, unit:'miles'}` |

Notes:
- **`assigned-school` is the headline** — it carries the dominant actionable instruction
  (CONSTRAINT-015 satisfied structurally). provenance = Google Places (the nearest-school
  data the caveat qualifies).
- `level` is lower-cased only in the subject string (presentation-neutral token stays the level).
- Private schools are emitted individually (≤5) so each name+address is durable for the FE —
  the data already caps the list at 5.

## Provenance

All findings → `{ source: 'Google Places', asOf, modeled: false }`. `provenanceSummary`
dedupes (single source).

## Discovered issue (out of scope — flagged for a separate FR)

`getSchoolRatings()` does **not** call `checkCrossState`, unlike
`findNearestSchool()`/`findNearestElementarySchool()` (PM-001 / CONSTRAINT-006). A border
address (Jeffersonville IN) could surface a cross-state school in the chapter, and the data
shape carries no `location`/`state`, so the contract cannot flag it. This is a pre-existing
data/logic-layer gap; **recommend a dedicated postmortem + FR** to route `getSchoolRatings`
through `checkCrossState`. This FR faithfully serializes whatever the data layer returns and
does not attempt to fix the upstream gap (surgical scope).

## Wiring

`reportBuilder.js` envelope:
```js
schools: chapters?.schools
  ? buildSchoolsContract(chapters.schools, { degraded: degradation.total > 0 })
  : null,
```

## Acceptance criteria

- AC-1: null / empty input → null ⇒ envelope `schools: null`.
- AC-2: full input → `ChapterContractSchema.safeParse(c).success === true`.
- AC-3: `assigned-school` finding present (bucket check, tone caution) with instruction `fallbackAction`.
- AC-4: each public school finding carries `place {name,address}` + a measure; tone derives across drive-time tiers.
- AC-5: public school with `driveTimeMinutes: null` → measure in `miles`, tone neutral.
- AC-6: each private school is its own finding with `place` + miles measure, bucket cool.
- AC-7: no finding carries `score`/`grade`/`rating`; serialized JSON contains no `"color"` (CONSTRAINT-001/008).
- AC-8: no schema change — existing utilities/community/health contract tests pass unchanged; schemaVersion stays `1.0`.
- AC-9: per-address snapshots incl. Jeffersonville IN (CONSTRAINT-011).
- AC-10: full suite green; CI green.
