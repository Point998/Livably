# PM-003 — Hospital Search Returned Second-Nearest
*Date: May 2026*

## What Happened
Hospital search was returning Google's first text search result rather than the hospital with the shortest actual drive time.

## Why It Happened
Google text search ranks by relevance, not distance. The most relevant result for "hospital emergency department" is not necessarily the nearest one.

## Fix Applied
Calculate drive time for top 5 results and return the one with the shortest drive time.

## Constraint Added
**CONSTRAINT-003:** Hospital search must verify by actual drive time across top 5 candidates. Never trust Google's relevance ranking for safety-critical destinations (hospital, urgent care). Enforced in `src/modules/health/logic.js`.
