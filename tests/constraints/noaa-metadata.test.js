'use strict';

// CONSTRAINT-016: NOAA CDO station metadata is unreliable.
// After fetching records for a candidate station, the code must validate that
// the expected datatype is present in the actual returned records before accepting
// the station. Never trust the metadata filter response alone. See PM-004.
//
// NOTE: getNOAAClimateNormals was extracted to src/modules/climate/data.js
// as part of the module extraction refactor. Tests now check that file.

const fs = require('fs');
const path = require('path');

const CLIMATE_MODULE_SRC = fs.readFileSync(
  path.join(__dirname, '../../src/modules/climate/data.js'),
  'utf8'
);

describe('CONSTRAINT-016: NOAA station records validated before acceptance', () => {
  test('climate/data.js validates MLY-TMAX-NORMAL presence in returned records', () => {
    // The fix from PM-004 — check actual records, not just station metadata
    expect(CLIMATE_MODULE_SRC).toMatch(/MLY-TMAX-NORMAL/);
  });

  test('climate/data.js skips stations whose records lack TMAX data', () => {
    // Must contain a guard that skips stations with no actual TMAX records
    // Pattern: check results array for the datatype before accepting
    expect(CLIMATE_MODULE_SRC).toMatch(
      /results\.some\([^)]*datatype.*MLY-TMAX-NORMAL|MLY-TMAX-NORMAL.*continue/
    );
  });

  test('climate/data.js uses progressive radius expansion for station search', () => {
    // 25mi → 50mi → 100mi radius expansion per CONSTRAINT-016 fix
    expect(CLIMATE_MODULE_SRC).toMatch(/NOAA_STATION_SEARCH_RADII|for.*radius.*RADII/);
  });
});
