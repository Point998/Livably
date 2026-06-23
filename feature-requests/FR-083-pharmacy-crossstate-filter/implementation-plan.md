# FR-083 — Implementation Plan

Ordered by layer (data → template → integration), tests alongside each step (CONSTRAINT-011).

## Task 1 — Data layer: cross-state on pharmacy selection
**File:** `src/modules/reachability/data.js`

1. Import `checkCrossState` from `../../shared/validate` (alongside the existing
   `checkDriveTimeCoherence, classifyBand`).
2. Add a private `finalizePharmacyRecord(record, originState)` helper:
   - `const { valid: sameState, resultState } = await checkCrossState(record.location, originState);`
   - if `!sameState`: return `{ ...record, crossStateWarning: true, crossStateNote: \`This pharmacy is in ${resultState}. No in-state pharmacy was found within the search radius.\` }`
   - else: return `record` unchanged.
   - Mirrors `finalizeSafetyRecord` in `health/data.js`. Returns a **new** object on the
     cross-state branch so the cell-cached value is never mutated.
3. Change `findNearestPharmacy(originLatLng, cell = null)` →
   `findNearestPharmacy(originLatLng, cell = null, originState = '')`. After `sourceChain`
   resolves `picked`, `return finalizePharmacyRecord(picked.value, originState);` (still throw
   when `!picked`). `record.location` exists on both the Google record and the OSM record
   (`osmRecord` sets `location: { lat, lng }`), so one call covers both providers.
4. Leave `findNearestPharmacyGoogle` / `findNearestPharmacyOSM` and their cell caching untouched
   — the cross-state layer sits above them, per-address.

**Tests (alongside):** `tests/modules/reachability/data.test.js`
- Add `checkCrossState: jest.fn()` to the `../../../src/shared/validate` mock; default it in
  `beforeEach` to `{ valid: true, resultState: '' }` (in-state / no-op default).
- New `describe('findNearestPharmacy cross-state (PM-006 / CONSTRAINT-006)')`:
  - AC-1: `checkCrossState` → `{ valid: false, resultState: 'KY' }`; assert result has
    `crossStateWarning: true` and `crossStateNote` containing `KY`.
  - AC-2: default (valid) → no `crossStateWarning`.
  - AC-3: call with no `originState`; assert unchanged (and that with the real no-op semantics
    the flag is absent — here just assert default mock path leaves it clean).
  - AC-4: two calls sharing one `CELL` (one with `valid:false`, one with `valid:true`) — assert
    the first is flagged and the second is not, proving the cached selection wasn't mutated.

## Task 2 — Template layer: render the note
**File:** `src/modules/reachability/template.js`

1. In `generateDailyConveniencesNarrative(grocery, pharmacy, gasStation)`, when
   `pharmacy?.crossStateNote` is present, append it as its own sentence/paragraph in the
   pharmacy prose (both the OSM straight-line branch and the drive-time branch). Mirror the
   health template: surface `pharmacy.crossStateNote` text. No inline styles (CONSTRAINT-008);
   use the existing paragraph structure / semantic classes already in this function.

**Tests (alongside):** `tests/modules/reachability/template.test.js`
- AC-5: pharmacy with `crossStateNote` → narrative output contains the note text; pharmacy
  without it → note absent.

## Task 3 — Wire the call site
**File:** `src/services/reportBuilder.js`

1. `findNearestPharmacy(originLatLng, cell)` → `findNearestPharmacy(originLatLng, cell, originState)`
   with a `// CONSTRAINT-006: cross-state filter` comment (matching the hospital/urgent-care lines).
2. `compareBuilder.js` — no change (documented in spec §6).

## Task 4 — Integration regression
**File:** `tests/integration/jeffersonville.test.js`
- AC-6: extend the existing IN-origin assertions to cover the pharmacy finding (in-state, or
  flagged cross-state). Follow the file's existing mocking/assertion style.

## Task 5 — Verify
- `npx jest` full suite green (AC-8). Confirm the 5-address integration coverage passes (AC-7).

## Risks / unknowns
- **Cache poisoning** is the main trap; Task 1.2/1.3 explicitly returns a new object and applies
  the check above the cache. AC-4 guards it.
- `jeffersonville.test.js` mocking shape — read the file before editing to match how it stubs
  `checkCrossState` / reachability data (it may already mock validate at a different layer).
- Template branch coverage: the function has an OSM straight-line branch and a drive-time branch;
  the note must render in both. AC-5 should cover at least the drive-time branch; add the OSM
  branch if cheap.
