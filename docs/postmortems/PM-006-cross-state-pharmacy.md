# PM-006 — Cross-State Pharmacy in the Reachability Data Path (CONSTRAINT-006 recurrence)
*Date: June 2026*
*Discovered during the FR-082 follow-on cross-state audit (session 7 hand-off) — a latent gap, not yet observed in a delivered report. Documented per CONSTRAINT-012 because it is a recurrence of the PM-001 class of bug in a third, uncovered code path.*

## What Happened
CONSTRAINT-006 explicitly names **pharmacy** as a finding that may not silently come from a different state than the origin address. PM-001 added `checkCrossState` to the school search; FR-082 (PM-005) closed the schools *chapter* path; the health module guards hospital and urgent care. But the pharmacy finding lives in a different module — **`src/modules/reachability/data.js`** — and `findNearestPharmacy()` (and both of its sub-fetchers, `findNearestPharmacyGoogle` / `findNearestPharmacyOSM`) **has no `originState` parameter and never calls `checkCrossState`.**

So for a border address — `1007 Stonelilly Dr, Jeffersonville IN 47130` — the Daily Conveniences section can surface a Kentucky pharmacy (e.g. across the Ohio River in Louisville) as "the nearest pharmacy" with no cross-state label, even though every other finding in CONSTRAINT-006's named list is guarded. The exact bug PM-001 closed remains open in the one module the prior fixes never touched.

## Why It Happened
1. CONSTRAINT-006 was enforced **per-function / per-module** (school, then schools chapter, then hospital, then urgent care) rather than swept across *every* search in the constraint's named list. Pharmacy was named in the constraint text but never routed through the coherence layer — it was built as a daily-lifestyle destination (FR-058 banding, FR-066 OSM fallback) and inherited none of the safety-tier guards.
2. The Jeffersonville IN regression test (`tests/integration/jeffersonville.test.js`) asserts in-state results for the school/hospital paths only — it never exercised `findNearestPharmacy`, so the gap was invisible to CI.
3. Pharmacy shares the FR-058 cell cache (keyed by `cellId`). An H3 cell can straddle a state border, so the cross-state determination is **address-specific** (depends on the asking address's `originState`, not the cell). Any fix must compute cross-state per-address on the final selection and must never bake the flag into the cell-cached value — exactly the subtlety the health module already documents in `finalizeSafetyRecord`.

## Root Cause
Same as PM-001 / PM-005: **CONSTRAINT-006 enforced per-search instead of per-search-class.** A search of a named class (pharmacy) was retained without routing through `checkCrossState` in `src/shared/validate.js`. This is precisely the failure mode CONSTRAINT-014 warns about — coherence rules must be applied uniformly via validate.js, not skipped per module.

## Impact
- Severity: medium. Affects only border addresses (Jeffersonville IN is the known case). Misleads a buyer about which pharmacy serves their address — a decision-relevant error in a daily-needs finding.
- Surface: the rendered Reachability "Daily Conveniences" narrative (`src/modules/reachability/template.js`). Reachability is **not yet on the headless contract** (rollout 4/14), so unlike PM-005 there is no contract serialization to correct — only the rendered report.

## Fix (applied — FR-083)
`findNearestPharmacy` now takes `originState` (threaded from `locationInfo.state` in `reportBuilder`) and routes the final selected pharmacy through `checkCrossState(record.location, originState)` **after** the source chain resolves — covering the Google and OSM paths uniformly, in one place, per-address. Policy mirrors the health module's safety tier (pharmacy is grouped with hospital/urgent care in CONSTRAINT-006, and medication access is safety-adjacent): the nearest pharmacy is always returned (CONSTRAINT-015), but a cross-state result is **warned, not rejected** — it gets `crossStateWarning: true` + a `crossStateNote`. The cross-state decoration returns a **new object** rather than mutating the cell-cached selection, so two addresses sharing a border-straddling cell each get their own correct determination (no cache poisoning). When `originState` is empty, `checkCrossState` is a no-op so behavior is unchanged. The reachability template surfaces `crossStateNote` in the Daily Conveniences narrative. See `feature-requests/FR-083-pharmacy-crossstate-filter/`.

## Constraint
No new constraint. This is a **CONSTRAINT-006 enforcement gap**, not a new class. Reinforces **CONSTRAINT-014** (coherence belongs in validate.js and must be applied to *all* searches of a class). With FR-083, every member of CONSTRAINT-006's named list (school, hospital, urgent care, pharmacy) is now guarded.

## Tests Added (FR-083)
- `tests/modules/reachability/data.test.js` — PM-006 regression for the pharmacy path, Jeffersonville IN origin: a KY pharmacy is flagged `crossStateWarning` + note; an in-state pharmacy is not flagged; no-op when `originState` is empty; the cell cache is not poisoned (an IN address and a KY address sharing a cell each get the correct, independent determination).
- `tests/modules/reachability/template.test.js` — the cross-state note is rendered in the Daily Conveniences narrative when present.
- `tests/integration/jeffersonville.test.js` — extended to assert the pharmacy finding is in-state (or explicitly flagged) for the IN origin.

## Class of Bug
Jurisdictional coherence failure (same as PM-001 / PM-005). Lesson reaffirmed: when a postmortem fix is applied, audit **every** code path in the named search class — across modules, not just the function in the bug report. With pharmacy closed, CONSTRAINT-006's named list is fully covered; grocery/gas/coffee are deliberately **out of scope** (the constraint omits them — they are not jurisdiction-sensitive findings).
