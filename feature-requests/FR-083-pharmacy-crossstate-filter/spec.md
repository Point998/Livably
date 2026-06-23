# FR-083 — Cross-state filter for findNearestPharmacy (PM-006 fix)

**Status:** Spec · **Module:** `src/modules/reachability/` + call site in `src/services/reportBuilder.js`
**Origin:** PM-006 · **Constraint:** CONSTRAINT-006 enforcement gap · **Date:** 2026-06-23

## Problem

`findNearestPharmacy()` (the Reachability "Daily Conveniences" data path) does not route its
result through `checkCrossState`, so a border address (Jeffersonville IN) can surface a
cross-state (KY) pharmacy as "the nearest pharmacy" with no label. CONSTRAINT-006 names
pharmacy explicitly. PM-001/FR-082 closed schools; the health module guards hospital and
urgent care; pharmacy was never routed through the coherence layer. See PM-006 for analysis.

## Goal

Apply CONSTRAINT-006 to the pharmacy finding: the selected pharmacy must pass
`checkCrossState` before it is presented, and a cross-state result must be explicitly labeled.

## Policy decision (and why)

**Warn, don't reject** — mirror the health module's safety tier (`finalizeSafetyRecord`),
not the schools "prefer-in-state, drop-beyond-50mi" model.

Rationale: pharmacy is grouped with hospital and urgent care in CONSTRAINT-006's named list,
and medication access is safety-adjacent. A border-town buyer's genuinely-nearest pharmacy is
often across the line (Jeffersonville IN → Louisville KY) and is a real, usable option
(prescriptions transfer across state lines). Always returning the nearest pharmacy with a
clear cross-state label satisfies both CONSTRAINT-006 ("explicitly labeled as cross-state")
and CONSTRAINT-015 (always a usable result, never silence). It also matches the current
single-nearest design (`placesNearby` `rankby: distance`), so no multi-candidate refactor is
needed. The schools "drop and prefer in-state" model was considered and rejected: it fits an
*evaluative* finding (which schools serve you) better than a *convenience* finding (where do I
fill a prescription), and would require fetching/reverse-geocoding multiple candidates.

## Requirements

1. Thread `originState` into `findNearestPharmacy(originLatLng, cell, originState)`
   (currently `(originLatLng, cell)`). It is available at the `reportBuilder` call site as
   `originState`, derived from reverse geocoding at report start (same value already passed to
   `findNearestHospital`).
2. After the source chain resolves the final pharmacy (Google primary or OSM fallback), call
   `checkCrossState(record.location, originState)`. Apply it **once, at the public
   `findNearestPharmacy` entry** so both providers are covered uniformly and the check is
   per-address (not inside the cell-cached sub-fetchers).
3. If the result is cross-state, return a **new object** with `crossStateWarning: true` and
   `crossStateNote: "This pharmacy is in {STATE}. No in-state pharmacy was found within the
   search radius."` — never mutate the cell-cached selection (an H3 cell can straddle a border;
   two addresses in the same cell with different `originState` must each get the correct flag).
4. When `originState` is empty, `checkCrossState` is a no-op (returns valid) → result unchanged.
5. Surface `crossStateNote` in the Reachability "Daily Conveniences" narrative
   (`src/modules/reachability/template.js`), mirroring how the health template renders
   `urgentCare.crossStateNote`.
6. `compareBuilder.js` left as-is (calls `findNearestPharmacy(originLatLng)` → `originState`
   defaults to '' → no-op). This is consistent with how compareBuilder already invokes
   `findNearestHospital` without a state; the compare path is out of scope for PM-006.

## Acceptance criteria

- AC-1: a mocked KY pharmacy for a Jeffersonville IN origin (`originState: 'IN'`) returns with
  `crossStateWarning: true` and a `crossStateNote` naming KY.
- AC-2: a mocked in-state (IN) pharmacy for the same origin returns with no `crossStateWarning`.
- AC-3: when `originState` is empty/omitted, the result is returned unchanged (no-op) — preserves
  current behavior and `compareBuilder`.
- AC-4: the cell cache is not poisoned — an IN-origin and a KY-origin call sharing one `cellId`
  each receive the correct, independent cross-state determination (one flagged, one not).
- AC-5: the reachability template renders the cross-state note when present, and omits it when absent.
- AC-6: `tests/integration/jeffersonville.test.js` asserts the pharmacy finding is in-state
  (or explicitly flagged cross-state) for the IN origin.
- AC-7: no behavior change for non-border addresses (Georgetown / Harlan / Louisville / Bozeman).
- AC-8: full suite green incl. all 5 test addresses.

## Notes

- Reinforces CONSTRAINT-014 (coherence in validate.js, applied to all searches of a class).
- Reachability is **not yet on the headless contract** (rollout 4/14), so — unlike FR-082 — there
  is no contract.js to update. When the reachability contract lands later, it should read the
  `crossStateWarning`/`crossStateNote` markers (mirrors health contract). Tracked as a follow-on.
- With FR-083, CONSTRAINT-006's named list (school, hospital, urgent care, pharmacy) is fully
  covered. Grocery/gas/coffee remain deliberately out of scope.
