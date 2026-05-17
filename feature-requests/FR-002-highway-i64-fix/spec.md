# FR-002 — Highway Interstate Fallback Fix

## What

Fix `findNearestHighwayOnRamp` so that interstates accessible via another nearby interstate are correctly detected as within 20 minutes, even when Google's geocoding returns a representative midpoint that is not the nearest on-ramp.

## Root Cause (discovered in Phase 1)

Google's Geocoding API, when queried with `{highway} near {city}, {state}`, returns a **representative midpoint** for the highway within the state — not the nearest accessible entry point from the origin.

For `"I-64 near Georgetown, KY"`:
- Google returns: `I-64, Kentucky, USA` at lat 38.033, lng -84.261 (east of Lexington)
- Drive time from Georgetown to that point: **35 minutes** → fails the ≤20 min filter
- But the nearest actual I-64 access from Georgetown is the **I-75/I-64 interchange** in Lexington at lat 38.112, lng -84.512 — only **14 minutes** away

The existing highway-name validation filter is NOT the bug — `"I-64, Kentucky, USA"` correctly passes validation. The bug is the wrong geocoded point being used for the drive-time check.

`bounds` biasing does not fix this: Google ignores it for route geocoding and returns the same midpoint regardless of bounds parameters.

## Inputs

- `originLatLng` — string `"lat,lng"` of the address being researched
- `city`, `state` — derived from reverse geocoding the origin (already in the function)
- The existing `interstates` list

## Outputs

Same as current: `{ name, address, location, driveTimeMinutes, note }` where `note` contains the "Also within 20 minutes" list when applicable.

## The Fix

Add an **interchange fallback** as a second pass after the initial geocode + drive-time calculation:

1. **First pass** (existing): geocode all interstates, validate by name, compute drive times.
   - Produces `within20` (≤ 20 min) and `borderline` (> 20 min, ≤ 50 min) sets.
   - Interstates > 50 min are discarded — too far to be worth probing.

2. **Second pass** (new): for each `borderline` interstate, try a junction query with the nearest `within20` interstate:
   - Query: `{borderline_highway}/{nearest_within20_highway} {state}`
   - Example: `I-64/I-75 KY` → `"I-64 & I-75, Lexington, KY 40511, USA"` → 14 min ✓
   - If the result passes highway-name validation AND drive time ≤ 20 min, promote the interstate to `within20` with the interchange's drive time and address.

3. Use the combined `within20` set (from both passes) for the primary/note output.

## Acceptance Criteria

- Report for `100 Wishing Well Path Unit 2306, Georgetown, KY 40324` shows:
  - Primary: I-75 (closest, ~9 min)
  - Note: "Also within 20 minutes: I-64 (14 min)"
- No false positives: I-40, I-90, I-95 do NOT appear for Georgetown
  - Confirmed in investigation: their interchange queries return points 174–802 min away or fail validation
- Rural address `456 Rural Route 1, Harlan, KY 40831` still shows only I-75 (138 min) as the fallback closest (no within-20 interstates)
- Urban address `123 Main St, Louisville, KY 40202` still shows I-64 and/or I-71 correctly (already within 20 min via primary geocode, no interchange needed)

## Edge Cases

**No within-20-min interstates exist:** The interchange fallback is skipped entirely. The existing fallback (return the single closest, regardless of drive time) continues to work.

**Multiple borderline highways:** Each tries the same nearest within-20 highway. Only those whose interchange point is ≤ 20 min are promoted.

**Interchange query returns wrong highway:** Validation check (highway name in formatted_address) filters these out. Confirmed safe for I-90/I-75 and I-95/I-75 which returned "I-75, Kentucky, USA" (fails I-90/I-95 name check).

**Interchange query returns a far-away point:** Drive time > 20 min → not promoted. Confirmed safe for I-40/I-75 KY which returned the Knoxville, TN interchange at 174 min.

## Not In Scope

- Fixing the highway list (adding/removing interstates)
- Changing the 20-minute threshold
- Improving the primary geocoding query for other states (this fix generalizes via the interchange pattern)
- FR-003 or later features
