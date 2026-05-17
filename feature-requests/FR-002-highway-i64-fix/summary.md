# FR-002 — Highway Interstate Fallback Fix: Summary

## What was built

Added an interchange fallback to `findNearestHighwayOnRamp` in `src/app.js`.

## Root cause (confirmed)

The bug was NOT in the highway-name validation filter. Google's Geocoding API returns a representative midpoint for a highway within a state, not the nearest on-ramp. `"I-64 near Georgetown, KY"` returned a point east of Lexington (35 min away). The actual nearest I-64 access from Georgetown is the I-75/I-64 interchange in Lexington, only 14 min away. `bounds` biasing had no effect.

## Change

**`findNearestHighwayOnRamp`** — after computing drive times for all geocoded highway points, added a second pass:

1. Find all interstates whose geocoded point is **> 20 min but ≤ 50 min** (borderline)
2. For each borderline interstate, query `{far_highway}/{nearest_within20_highway} {state}` to find the interchange
3. If the interchange passes the highway-name validation and its drive time is ≤ 20 min, add it to the results
4. Duplicate guard: skip if the highway is already represented in the ≤ 20 min set

## Test results

**Georgetown** (`100 Wishing Well Path Unit 2306, Georgetown, KY 40324`):
- I-64: 10 min (via I-64/I-75 interchange in Lexington)
- I-75: 11 min
- Both correctly appear ✓

**Harlan (rural)** (`456 Rural Route 1, Harlan, KY 40831`):
- I-75: 138 min (fallback, no within-20 highways)
- No I-64 or other false positives ✓
- Interchange fallback correctly skipped (no within-20 highways to anchor it) ✓

**Louisville (urban)** (`123 Main St, Louisville, KY 40202`):
- I-71: 10 min, I-65: 11 min, I-64: 18 min
- All via primary geocode (no interchange needed) ✓
- No regressions ✓

## Deviations from plan

None. All tasks completed as specified. The duplicate guard from the plan's risk section was included.
