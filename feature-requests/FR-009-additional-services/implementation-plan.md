# FR-009 — Additional Services: Implementation Plan

## Approach

Add four new lookup functions, wire them into `Promise.allSettled`, and render results in two places:
- **Gas station** → promoted to core service; appears in Chapter 03 and in FR-008 Daily Conveniences narrative
- **Park, Coffee Shop, Elementary School** → new "Additional Places" chapter card after Chapter 03

No new npm packages. No new CSS — additional places card reuses existing chapter-card styles.

## New functions (`src/app.js`)

- `findNearestGasStation` — `placesNearby` with `type: 'gas_station'`, nearest by distance
- `findNearestPark` — `placesNearby` with `type: 'park'`, nearest by distance
- `findNearestCoffeeShop` — `textSearch` for 'coffee shop', excludes convenience store chains
- `findNearestElementarySchool` — `textSearch` for 'public elementary school', excludes preschool/daycare/montessori/private

## Route changes

`Promise.allSettled` extended from 6 to 10 calls. All new services are covered by `allSettled` so failures don't break the report.

## `buildReportHTML` changes

- `gasStation` added to Chapter 03 sectionsHTML (after Highway Access, before School)
- `gasStation` added to map pins
- `park`, `coffeeShop`, `elementarySchool` added to map pins
- `buildInsightsCardHTML` call updated to pass `gasStation`
- `buildAdditionalServicesCardHTML` called; result injected after Chapter 03 card

## FR-008 narrative update

`generateDailyConveniencesNarrative` now accepts `gasStation` as a third argument. Average includes gas station when available; gas station appears in the breakdown row and details sentence.

## `buildAdditionalServicesCardHTML`

Returns empty string if all three services are null. Otherwise renders a chapter card with `buildDestSection` for each (which already handles null with "Not available.").
