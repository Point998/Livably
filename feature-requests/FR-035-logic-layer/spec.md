# FR-035 Spec — Logic Layer (validate.js)
*Phase 2 of the Module Restructure*
*Status: Spec*

---

## What This Is

`src/shared/validate.js` is the single place where cross-module coherence rules live (CONSTRAINT-014). No individual module may implement its own cross-state filtering, rural detection, or drive time coherence check — these live here and are called by all modules.

Three rules ship in FR-035:
1. Rural mode detection (CONSTRAINT-007)
2. Cross-state result filtering (CONSTRAINT-006)
3. Drive time coherence check (CONSTRAINT-010)

---

## Inputs and Outputs

### 1. `detectRuralMode(tractPopulation, avgDriveMinutes)`

**Purpose:** Classify an address as urban/suburban/rural/remote before any narrative is generated.

**Inputs:**
- `tractPopulation` — Census tract total population (integer, already fetched via `src/shared/census.js`)
- `avgDriveMinutes` — average drive time to the nearest grocery store (float, already computed by reachability module). `null` is allowed when data is unavailable.

**Output:**
```js
{
  mode: 'urban' | 'suburban' | 'rural' | 'remote',
  label: string   // human-readable: "Urban", "Suburban", "Rural", "Remote"
}
```

**Classification rules:**
| Mode | Population | Avg grocery drive |
|------|-----------|------------------|
| urban | > 5000 | any |
| suburban | > 1000 | ≤ 20 min |
| rural | ≤ 1000 OR (> 1000 AND > 20 min) | any |
| remote | ≤ 200 OR grocery > 45 min | any |

Priority: remote > urban > suburban > rural.
If `avgDriveMinutes` is `null`, classify by population alone (urban/suburban/rural only — never remote from drive time alone).

**This function is pure (no API calls, no side effects). Synchronous.**

---

### 2. `checkCrossState(resultLatLng, originState)`

**Purpose:** Reject any school, hospital, urgent care, or pharmacy result that is in a different state than the origin address unless no in-state option exists within 50 miles. (CONSTRAINT-006)

**Inputs:**
- `resultLatLng` — `{ lat, lng }` object or `"lat,lng"` string from the module data layer
- `originState` — 2-letter state abbreviation extracted from reverse geocoding at report start (e.g. `"IN"`)

**Output:**
```js
{
  valid: boolean,        // true if same state, false if different state
  resultState: string    // 2-letter abbreviation of the result's state (empty string on error)
}
```

**This function is async (calls reverseGeocodeAddress internally).**

**Edge cases:**
- If reverse geocode of result fails → `{ valid: true, resultState: '' }` (fail open, don't block)
- If originState is empty string → `{ valid: true, resultState: '' }` (can't enforce without origin state)
- Cross-state is only rejected for school, hospital, urgent care, pharmacy — NOT highway (highways cross state lines by design)

---

### 3. `checkDriveTimeCoherence(driveTimeMinutes, destinationLabel, ruralMode)`

**Purpose:** Flag any daily destination result with a drive time >45 minutes when the address is not classified as rural or remote. (CONSTRAINT-010)

**Inputs:**
- `driveTimeMinutes` — drive time returned by the data layer (number)
- `destinationLabel` — human-readable name for logging (e.g. `"grocery store"`)
- `ruralMode` — the `mode` string from `detectRuralMode()` output (`'urban'|'suburban'|'rural'|'remote'`)

**Output:**
```js
{
  ok: boolean,     // true if drive time is coherent, false if suspicious
  reason: string   // empty string when ok; explanation when not ok
}
```

**Rules:**
- `ok: true` when `driveTimeMinutes <= 45`
- `ok: true` when `ruralMode === 'rural'` or `ruralMode === 'remote'` (any drive time is valid)
- `ok: false` when `driveTimeMinutes > 45` AND `ruralMode` is `'urban'` or `'suburban'`

**This function is pure. Synchronous.**

---

## Acceptance Criteria

- [ ] `detectRuralMode` classifies all 5 test addresses correctly (see below)
- [ ] `checkCrossState` rejects a KY school result when origin is Jeffersonville IN (PM-001 regression)
- [ ] `checkCrossState` returns `valid: true` for same-state results
- [ ] `checkCrossState` fails open (returns valid) when reverse geocode fails
- [ ] `checkDriveTimeCoherence` flags >45 min grocery for an urban/suburban address
- [ ] `checkDriveTimeCoherence` passes >45 min grocery for a rural/remote address
- [ ] All functions are exported from `src/shared/validate.js`
- [ ] Tests in `tests/shared/validate.test.js` cover all rules and all 5 addresses
- [ ] No module imports validate.js and also implements its own version of these rules

---

## Expected Classification for Test Addresses

| Address | Mode |
|---------|------|
| Georgetown KY (suburban) | suburban |
| Harlan KY (rural Appalachian) | rural |
| Louisville KY (urban) | urban |
| Bozeman MT (western city) | suburban |
| Jeffersonville IN (border city) | suburban |

---

## Modules That Must Call validate.js

| Module | Function | Rule to apply |
|--------|----------|---------------|
| schools/data.js | findNearestSchool, findNearestElementarySchool | checkCrossState |
| reachability/data.js | findNearestGrocery | checkDriveTimeCoherence |
| health/data.js | findNearestHospital, findNearestUrgentCare | checkCrossState |

---

## What validate.js Does NOT Do

- Generate HTML
- Make Google Places API calls
- Implement Fair Housing logic (that lives in `src/modules/community/logic.js` when that module is built)
- Score or grade addresses
- Produce finding text — it produces coherence verdicts that callers use
