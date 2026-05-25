# PM-001 — Cross-State School Result
*Date: May 2026*

## What Happened
Running a report for 1007 Stonelilly Dr, Jeffersonville IN 47130 returned Chenoweth Elementary School in Louisville KY (23 min away) as the nearest school. The address is in Indiana; the school is in Kentucky, across the Ohio River.

## Why It Happened
The school search function (`findNearestSchool` in app.js) uses Google Places `placesNearby` ranked by distance. Google returns results by geographic proximity without regard to state boundaries. The function had no state boundary filter — it accepted the first result regardless of which state it was in.

The result passed the name validation filter (the school's name contains "Elementary") and the type filter (Google tagged it as type: school). Both checks passed. No jurisdictional check existed.

## Root Cause
Missing jurisdictional coherence layer. The data layer (Google Places) correctly returns geographically nearby results. The problem is there was no logic layer to validate that results are jurisdictionally appropriate for the address.

## Fix Applied
Added state extraction from origin address geocoding result. School search results are filtered to exclude any result whose formatted_address contains a different state abbreviation than the origin address.

## Constraint Added
**CONSTRAINT-006:** No school, hospital, urgent care, or pharmacy result from a different state than the origin address may be used as a primary finding. Cross-state results are only permissible when no in-state option exists within 50 miles, and must be explicitly flagged as cross-state. Enforced in `src/shared/validate.js`.

## Tests Added
- `tests/logic/validate.test.js` — cross-state filter test
- `tests/integration/jeffersonville.test.js` — full report test confirming Indiana schools for Jeffersonville IN address

## Class of Bug
Jurisdictional coherence failure. Other searches that could exhibit this bug: hospital (border cities near major metro hospitals in adjacent states), urgent care, pharmacy.
