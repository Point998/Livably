# PM-004 — NOAA CDO Station Metadata Unreliable
Date: May 2026

## What Happened
Louisville KY climate normals section rendered without temperature data. The nearest NOAA CDO station (BEDFORD 4 SW, IN) appeared in a `datatypeid=MLY-TMAX-NORMAL` filtered search but had no actual TMAX/TMIN records for the 2010 normals period.

## Why It Happened
NOAA CDO station metadata does not accurately reflect what data is actually available for a given station and time period. A station can pass a datatype filter query without having records matching that datatype.

## Fix Applied
After fetching records for a candidate station, validate that TMAX datatype is present in the actual returned records before accepting the station. If not present, iterate to the next candidate. Expand bounding box progressively (25mi → 50mi → 100mi) until a station with confirmed TMAX/TMIN data is found.

## Constraint Added
CONSTRAINT-016 in CLAUDE.md.

## Class of Issue
External API metadata unreliability. Applies to any NOAA CDO query that filters by datatype — always validate actual record content, never trust the filter response alone.
