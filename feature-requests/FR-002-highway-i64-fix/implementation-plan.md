# FR-002 Implementation Plan

## Overview

Single change to `findNearestHighwayOnRamp` in `src/app.js`. No new dependencies. No schema changes.

## Tasks

### 1. Extract `state` from reverse geocoding result

The function already reverse-geocodes the origin and extracts `city` and `state`. Confirm `state` (short_name, e.g. "KY") is available in scope for use in the interchange query. It already is — no change needed.

### 2. Add the borderline/interchange fallback after the drive-time calculation

Insert new logic between the existing `withDriveTimes` calculation and the `nearby` filter.

**Exact insertion point** — after this block (currently lines 316–323):
```javascript
const nearby = withDriveTimes
  .filter(Boolean)
  .filter((r) => r.driveTimeMinutes <= 20)
  .sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);

const candidates = nearby.length
  ? nearby
  : withDriveTimes.filter(Boolean).sort(...).slice(0, 1);
```

**New logic to add before the `nearby` filter:**

```javascript
// Interstates with representative geocoded points > 20 min may still be
// accessible within 20 min via an interchange with a nearby interstate.
// Try each "borderline" highway against the nearest validated within-20 highway.
const allValid = withDriveTimes.filter(Boolean);
const primary20 = allValid.filter((r) => r.driveTimeMinutes <= 20)
  .sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);

if (primary20.length) {
  const nearestHwy = primary20[0];
  const borderline = allValid.filter((r) => r.driveTimeMinutes > 20 && r.driveTimeMinutes <= 50);

  const interchangeResults = await Promise.all(
    borderline.map(async (farHwy) => {
      try {
        const query = `${farHwy.highway}/${nearestHwy.highway} ${state}`;
        const response = await googleMapsClient.geocode({
          params: { key: googleMapsApiKey, address: query },
        });
        const result = response.data.results?.[0];
        if (!result) return null;

        const returned = (result.formatted_address || '').toUpperCase();
        const num = farHwy.highway.replace('I-', '');
        const isReal =
          returned.includes(farHwy.highway.toUpperCase()) ||
          returned.includes(`INTERSTATE ${num}`) ||
          returned.includes(`I-${num}`) ||
          returned.includes(`I ${num}`);
        if (!isReal) return null;

        const driveTimeMinutes = await getDriveTime(originLatLng, result.geometry.location);
        if (driveTimeMinutes > 20) return null;

        return {
          highway: farHwy.highway,
          location: result.geometry.location,
          address: result.formatted_address,
          driveTimeMinutes,
        };
      } catch {
        return null;
      }
    }),
  );

  for (const r of interchangeResults) {
    if (r) allValid.push(r);
  }
}
```

Then replace the `nearby` / `candidates` block to use `allValid` instead of `withDriveTimes.filter(Boolean)`:

```javascript
const nearby = allValid
  .filter((r) => r.driveTimeMinutes <= 20)
  .sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);

const candidates = nearby.length
  ? nearby
  : allValid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes).slice(0, 1);
```

### 3. Test

Run the server and test three addresses:

- `100 Wishing Well Path Unit 2306, Georgetown, KY 40324`
  - Expected: Primary I-75 (~9 min), Note "Also within 20 minutes: I-64 (14 min)"
- `456 Rural Route 1, Harlan, KY 40831`
  - Expected: No within-20 interstates, fallback shows I-75 (~138 min). No I-64 note.
- `123 Main St, Louisville, KY 40202`
  - Expected: I-64 and/or nearby interstates appear correctly via primary geocode (≤ 20 min already)

### 4. Write summary.md

Document what was changed and confirm all three test addresses pass.

### 5. Commit and push

`git add src/app.js feature-requests/FR-002-highway-i64-fix/ && git commit -m "FR-002: fix highway detection via interchange fallback"`

## Risks

**Additional API calls:** Each borderline highway triggers one extra geocode + one extra distance matrix call. For a typical US address, there are 1–3 borderline highways at most. Acceptable.

**`state` being empty string:** If reverse geocoding fails to return a state component, `state` is `""`. The interchange query becomes `"I-64/I-75 "` which may return an unexpected result. The highway-name validation check and drive-time threshold are the safety net, but consider treating empty `state` as a skip condition for the interchange fallback.

**Duplicate entries in `allValid`:** If a borderline highway was already in `allValid` (it was, with drive time > 20), and the interchange result pushes a new entry for the same highway, `allValid` could contain the same highway twice with different drive times. The `nearby` filter and sort will include both, but the first one in sorted order will be the primary. This is harmless — the output `note` could theoretically list the same highway twice. To prevent, check for duplicates before pushing:

```javascript
if (r && !allValid.some((v) => v.highway === r.highway && v.driveTimeMinutes <= 20)) {
  allValid.push(r);
}
```
