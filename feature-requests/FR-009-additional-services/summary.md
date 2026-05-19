# FR-009 — Additional Services: Summary

## What was built

Four new service lookups: gas station (core), park, coffee shop, and elementary school (additional). No new npm packages or CSS.

## Changes

**`src/app.js`** — six modifications:

1. **`findNearestGasStation`** — `placesNearby` with `type: 'gas_station'`, nearest by distance.

2. **`findNearestPark`** — `placesNearby` with `type: 'park'`, nearest by distance.

3. **`findNearestCoffeeShop`** — `textSearch` for 'coffee shop' with radius 15km; excludes Sheetz, Circle K, 7-Eleven, Speedway, Wawa, Pilot, Love's via `isExcludedPlaceName`.

4. **`findNearestElementarySchool`** — `textSearch` for 'public elementary school' with radius 15km; excludes preschool, pre-school, daycare, day care, montessori, private via `isExcludedPlaceName`.

5. **`generateDailyConveniencesNarrative`** updated to accept `gasStation` as a third param. Includes gas in the average drive time, details sentence, and breakdown row. Completes the FR-008 Daily Conveniences section.

6. **`buildInsightsCardHTML`** updated to accept and pass `gasStation` to `generateDailyConveniencesNarrative`.

7. **`buildAdditionalServicesCardHTML`** — new function. Returns empty string if all three additional services are null; otherwise renders a "Additional Places / More Nearby Destinations" chapter card using existing `buildDestSection` (which shows "Not available." for nulls).

8. **`buildReportHTML`** — gas station added to Chapter 03 sectionsHTML between Highway Access and School; gas station, park, coffee shop, and elementary school added to map pins array; `additionalServicesCardHTML` injected after the Chapter 03 card.

9. **`/report` route** — `Promise.allSettled` extended from 6 to 10 calls; all four new services destructured from results; all passed to `buildReportHTML`.

## Test status

Syntactically verified (`node --check` passes). Live testing requires a valid API key.

## Deviations from spec

- Gas station treated as a core addition to Chapter 03 rather than an additional service, consistent with the spec's updated Promise.all listing.
- No CSS added — additional places card reuses existing chapter-card styles.
- Priority 2 services (library, restaurant, fitness) deferred; not in spec's Priority 1.
