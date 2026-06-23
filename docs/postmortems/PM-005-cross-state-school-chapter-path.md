# PM-005 — Cross-State School in the Chapter Data Path (CONSTRAINT-006 recurrence)
*Date: June 2026*
*Discovered during FR-081 (schools chapter → headless contract) discovery — a latent gap, not yet observed in a delivered report. Documented per CONSTRAINT-012 because it is a recurrence of the PM-001 class of bug in a second, uncovered code path.*

## What Happened
PM-001 fixed cross-state school results in `findNearestSchool()` / `findNearestElementarySchool()` (the lifestyle-destination path) by adding a `checkCrossState` rejection (CONSTRAINT-006). But the **Schools & Education chapter** does not render those functions — it renders `getSchoolRatings()` (`src/chapters.js`), a *separate* search that fans out three public-level text searches plus a private-school search. **`getSchoolRatings()` has no `checkCrossState` call.**

So for a border address — `1007 Stonelilly Dr, Jeffersonville IN 47130` — the schools *chapter* can still surface a Kentucky school (e.g. across the Ohio River in Louisville) as a "nearest public school," even though the PM-001 fix is in place for the other path. The exact bug PM-001 closed remains open one layer over.

## Why It Happened
1. PM-001's fix was applied to the function named in the postmortem (`findNearestSchool`), not to the *class* of search. `getSchoolRatings` was written/maintained as an independent path and never routed through the coherence layer.
2. The regression test `tests/integration/jeffersonville.test.js` asserts Indiana results for the **`findNearestSchool` path only** — it does not exercise `getSchoolRatings`, so the gap was invisible to CI.
3. The chapter data shape returned by `getSchoolRatings` carries no `location`/`state` per school (only `name`, `address`, `distanceMiles`, `driveTimeMinutes`), so downstream layers — including the FR-081 contract — **cannot** detect or flag cross-state results. The coherence check must happen inside `getSchoolRatings`, at fetch time, where `geometry.location` is still available.

## Root Cause
Same as PM-001: **missing jurisdictional coherence layer** — but specifically, CONSTRAINT-006 was enforced per-function instead of per-search-class. A second search of the same class (schools) was added/retained without routing through `checkCrossState` in `src/shared/validate.js`. This is precisely the failure mode CONSTRAINT-014 warns about (coherence rules must be applied uniformly via validate.js, not re-implemented or skipped per module).

## Impact
- Severity: medium. Affects only border addresses (Jeffersonville IN is the known case). Misleads a buyer about which schools serve the address — a Fair-Housing-adjacent, decision-relevant error.
- Surface: the rendered Schools chapter (`getSchoolRatings`) and, now, `contract.chapters.schools` (FR-081), which faithfully serializes the unfiltered result.

## Fix (planned — FR-082)
Route every per-level public result and every private result in `getSchoolRatings` through `checkCrossState(place.geometry.location, originState)` before inclusion. Follow CONSTRAINT-006's stated policy: drop cross-state results unless no in-state option exists within 50 miles, in which case include and **explicitly flag** as cross-state. Requires threading `originState` into `getSchoolRatings` (currently not a parameter). When a cross-state result is legitimately surfaced (no in-state option), add a `crossState` marker to the chapter data shape so the FR-081 contract can flag it (today it cannot — see cause #3).

## Constraint
No new constraint. This is a **CONSTRAINT-006 enforcement gap**, not a new class. Reinforces **CONSTRAINT-014** (coherence belongs in validate.js and must be applied to *all* searches of a class). Action item folded into CONSTRAINT-006's scope: the cross-state filter applies to **every** school search, including `getSchoolRatings`.

## Tests to Add (with FR-082)
- `getSchoolRatings` unit test: a mocked KY result for a Jeffersonville IN origin is dropped.
- Extend `tests/integration/jeffersonville.test.js` to assert the **chapter** path (not just `findNearestSchool`) returns only in-state schools.

## Class of Bug
Jurisdictional coherence failure (same as PM-001). Lesson: when a postmortem fix is applied, audit **all** code paths in that search class — not just the function named in the bug report. Other multi-path searches to re-audit for the same gap: hospital/urgent care (`getHealthcareDepth` vs `findNearestHospital`), pharmacy, grocery.
