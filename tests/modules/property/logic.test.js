'use strict';
const { buildHousingAgeBands } = require('../../../src/modules/property/logic');

function makeGet(data) {
  return (k) => data[k];
}

describe('buildHousingAgeBands', () => {
  const data = {
    'B25034_001E': '1000',
    'B25034_002E': '50',   // 2020+
    'B25034_003E': '150',  // 2010s
    'B25034_004E': '200',  // 2000s
    'B25034_005E': '180',  // 1990s
    'B25034_006E': '150',  // 1980s
    'B25034_007E': '100',  // 1970s
    'B25034_008E': '70',   // 1960s
    'B25034_009E': '40',   // 1950s
    'B25034_010E': '30',   // 1940s
    'B25034_011E': '30',   // Pre-1940
  };

  test('returns 7 bands', () => {
    const result = buildHousingAgeBands(makeGet(data));
    expect(result.bands).toHaveLength(7);
  });

  test('2010+ band combines _002E and _003E', () => {
    const result = buildHousingAgeBands(makeGet(data));
    const band = result.bands.find(b => b.label === '2010+');
    expect(band.count).toBe(200); // 50 + 150
  });

  test('Pre-1960 band combines _009E + _010E + _011E', () => {
    const result = buildHousingAgeBands(makeGet(data));
    const band = result.bands.find(b => b.label === 'Pre-1960');
    expect(band.count).toBe(100); // 40 + 30 + 30
  });

  test('percentages sum to 100 (±2 for rounding)', () => {
    const result = buildHousingAgeBands(makeGet(data));
    const total = result.bands.reduce((sum, b) => sum + b.pct, 0);
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
  });

  test('totalUnits matches total variable', () => {
    const result = buildHousingAgeBands(makeGet(data));
    expect(result.totalUnits).toBe(1000);
  });

  test('returns null when total is 0', () => {
    const result = buildHousingAgeBands(makeGet({ 'B25034_001E': '0' }));
    expect(result).toBeNull();
  });

  test('returns null when total is missing', () => {
    const result = buildHousingAgeBands(makeGet({}));
    expect(result).toBeNull();
  });

  test('suppressed cells (negative values) treated as 0', () => {
    const suppressed = { ...data, 'B25034_004E': '-666666666' };
    const result = buildHousingAgeBands(makeGet(suppressed));
    const band = result.bands.find(b => b.label === '2000s');
    expect(band.count).toBe(0);
    expect(band.pct).toBe(0);
  });
});
