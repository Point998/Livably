# PM-002 — Highway Search Returned Boat Ramp
*Date: May 2026*

## What Happened
Highway on-ramp search for Georgetown KY returned "Oregon Road Boat Ramp, Kentucky River" — 46 minutes away. The result had nothing to do with highway access.

## Why It Happened
The search query "highway on ramp" matched the word "ramp" generically. Google Places text search does not understand semantic intent — it matched the word, not the concept.

## Fix Applied
Replaced text search with interstate geocoding strategy. Each major US interstate is geocoded by name near the address city/state. Results are validated by checking that the returned address string contains the interstate name.

## Constraint Added
**CONSTRAINT-007:** Never use Google Places text search for highway access. Use the geocoding approach in `src/modules/reachability/data.js`. Interstate validation must confirm the highway name appears in the returned formatted_address.
