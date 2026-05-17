# FR-000 — Chapter 03 Data Layer

## What
Implement data collection for all Chapter 03 Daily Reachability destinations.

## Destinations
1. Grocery stores (top 3 nearest)
2. Pharmacy (nearest)
3. Hospital with full ER (nearest by actual drive time)
4. Urgent care (nearest, excluding retail clinics)
5. Highway access (nearest interstate within 20 min)
6. School (nearest by distance)

## Acceptance Criteria
- All 6 destinations return name, address, and drive time
- Drive times use Google Distance Matrix API at 8am Tuesday
- Hospital verified by drive time across top 5 results
- Grocery returns 3 results
- Highway shows interstate name and lists others within 20 min in note
- School includes assignment disclaimer
