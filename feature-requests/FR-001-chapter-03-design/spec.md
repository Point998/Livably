# FR-002 — Highway I-64 Fix

## What
Fix `findNearestHighwayOnRamp` to correctly return I-64 for addresses near Georgetown, KY where I-64 is within 20 minutes.

## Problem
The current address validation filter is rejecting I-64 even though it exists nearby. Debug logging was added but not yet read. The filter checks if the geocoded address string contains the highway name but Google may be returning a format that doesn't match.

## Acceptance Criteria
- Running report for `100 Wishing Well Path Unit 2306 Georgetown, KY 40324` shows:
  - Primary: I-75 (closest)
  - Note: "Also within 20 minutes: I-64 (X min)"
- No false positives (I-40, I-90, I-95 etc. must NOT appear)
- Works correctly for addresses near other interstates in other states

## Investigation Steps
1. Read current `findNearestHighwayOnRamp` implementation
2. Check what Google returns for "I-64 near Georgetown, KY" geocode call
3. Check what the address validation regex/string match is doing
4. Fix the mismatch
