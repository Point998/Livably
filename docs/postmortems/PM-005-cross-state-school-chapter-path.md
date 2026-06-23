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

## Fix (applied — FR-082)
`getSchoolRatings` now takes `originState` (threaded from `locationInfo.state`) and routes every per-level public candidate and every private candidate through `checkCrossState(place.geometry.location, originState)` before inclusion (cross-state checks for the bounded candidate set run in parallel). Policy per CONSTRAINT-006: pick the nearest **in-state** candidate; only if no in-state option exists does it permit the nearest cross-state one **within 50 mi**, marked `crossState: true` + `crossStateNote` on the entry; beyond 50 mi the level is dropped. Private candidates that are cross-state are dropped (supplementary list, no flag). When `originState` is empty, `checkCrossState` is a no-op so behavior is unchanged. The FR-081 schools contract now reads the `crossState` marker and sets `tone: caution` + the note in `defaultCopy`. See `feature-requests/FR-082-schools-crossstate-filter/`.

## Constraint
No new constraint. This is a **CONSTRAINT-006 enforcement gap**, not a new class. Reinforces **CONSTRAINT-014** (coherence belongs in validate.js and must be applied to *all* searches of a class). Action item folded into CONSTRAINT-006's scope: the cross-state filter applies to **every** school search, including `getSchoolRatings`.

## Tests Added (FR-082)
- `tests/chapters/schoolRatings.test.js` — PM-005 regression for the chapter path, Jeffersonville IN origin: KY result dropped for an in-state alternative; cross-state flagged within 50 mi; dropped beyond 50 mi; cross-state private schools dropped; no-op when `originState` empty.
- `tests/modules/schools/contract.test.js` — cross-state public school → contract `tone: caution` + note.

## Class of Bug
Jurisdictional coherence failure (same as PM-001). Lesson: when a postmortem fix is applied, audit **all** code paths in that search class — not just the function named in the bug report. Other multi-path searches to re-audit for the same gap: hospital/urgent care (`getHealthcareDepth` vs `findNearestHospital`), pharmacy, grocery.
