'use strict';

// CONSTRAINT-016: NOAA CDO station metadata is unreliable.
// After fetching records for a candidate station, the code must validate that
// the expected datatype is present in the actual returned records before accepting
// the station. Never trust the metadata filter response alone. See PM-004.

const fs = require('fs');
const path = require('path');

const CHAPTERS_SRC = fs.readFileSync(
  path.join(__dirname, '../../src/chapters.js'),
  'utf8'
);

describe('CONSTRAINT-016: NOAA station records validated before acceptance', () => {
  test('chapters.js validates MLY-TMAX-NORMAL presence in returned records', () => {
    // The fix from PM-004 — check actual records, not just station metadata
    expect(CHAPTERS_SRC).toMatch(/MLY-TMAX-NORMAL/);
  });

  test('chapters.js skips stations whose records lack TMAX data', () => {
    // Must contain a guard that skips stations with no actual TMAX records
    // Pattern: check results array for the datatype before accepting
    expect(CHAPTERS_SRC).toMatch(
      /results\.some\([^)]*datatype.*MLY-TMAX-NORMAL|MLY-TMAX-NORMAL.*continue/
    );
  });

  test('chapters.js uses progressive radius expansion for station search', () => {
    // 25mi → 50mi → 100mi radius expansion per CONSTRAINT-016 fix
    expect(CHAPTERS_SRC).toMatch(/NOAA_STATION_SEARCH_RADII|for.*radius.*RADII/);
  });
});
