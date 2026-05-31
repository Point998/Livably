'use strict';

const {
  getAQICategory,
  interpretFloodZone,
  estimateDNLFromRoad,
  getDNLCategory,
  estimateBortle,
  getBortleDescription,
  getRadonZone,
} = require('../../../src/modules/sensory/logic');

// ── getAQICategory ────────────────────────────────────────────────────────────

describe('getAQICategory', () => {
  test('AQI 0 → Good / green', () => {
    const r = getAQICategory(0);
    expect(r.label).toBe('Good');
    expect(r.color).toBe('green');
  });

  test('AQI 50 → Good (boundary)', () => {
    expect(getAQICategory(50).label).toBe('Good');
  });

  test('AQI 51 → Moderate', () => {
    expect(getAQICategory(51).label).toBe('Moderate');
  });

  test('AQI 100 → Moderate (boundary)', () => {
    expect(getAQICategory(100).label).toBe('Moderate');
  });

  test('AQI 151 → Unhealthy', () => {
    expect(getAQICategory(151).label).toBe('Unhealthy');
  });

  test('AQI 201 → Very Unhealthy', () => {
    const r = getAQICategory(201);
    expect(r.label).toBe('Very Unhealthy');
    expect(r.color).toBe('red');
  });

  test('returns an object with label, color, description', () => {
    const r = getAQICategory(75);
    expect(r).toHaveProperty('label');
    expect(r).toHaveProperty('color');
    expect(r).toHaveProperty('description');
  });
});

// ── interpretFloodZone ────────────────────────────────────────────────────────

describe('interpretFloodZone', () => {
  test('zone A → high risk, insurance required', () => {
    const r = interpretFloodZone('A');
    expect(r.insuranceRequired).toBe(true);
    expect(typeof r.risk).toBe('string');
  });

  test('zone X → minimal risk, no insurance required', () => {
    const r = interpretFloodZone('X');
    expect(r.insuranceRequired).toBe(false);
    expect(r.risk).toMatch(/[Mm]inimal/);
  });

  test('unknown zone → Unknown risk with fallback description', () => {
    const r = interpretFloodZone('ZZZ');
    expect(r.risk).toBe('Unknown');
    expect(r.insuranceRequired).toBe(false);
    expect(r.description).toBe('Flood zone data unavailable.');
  });
});

// ── estimateDNLFromRoad ───────────────────────────────────────────────────────

describe('estimateDNLFromRoad', () => {
  test('motorway very close → high DNL near 72', () => {
    const dnl = estimateDNLFromRoad('motorway', 0.01);
    expect(dnl).toBeGreaterThan(60);
  });

  test('motorway far away → lower DNL', () => {
    const closeBy = estimateDNLFromRoad('motorway', 0.1);
    const farAway = estimateDNLFromRoad('motorway', 1.0);
    expect(farAway).toBeLessThan(closeBy);
  });

  test('secondary road → lower base than motorway', () => {
    const motorway = estimateDNLFromRoad('motorway', 0.1);
    const secondary = estimateDNLFromRoad('secondary', 0.1);
    expect(secondary).toBeLessThan(motorway);
  });

  test('_link variant treated as base type (motorway_link → motorway)', () => {
    const link = estimateDNLFromRoad('motorway_link', 0.1);
    const base = estimateDNLFromRoad('motorway', 0.1);
    expect(link).toBe(base);
  });

  test('result never below 38 (floor)', () => {
    const dnl = estimateDNLFromRoad('secondary', 100);
    expect(dnl).toBeGreaterThanOrEqual(38);
  });

  test('unknown type falls back to 52 base', () => {
    const dnl = estimateDNLFromRoad('tertiary', 0.01);
    expect(typeof dnl).toBe('number');
    expect(dnl).toBeGreaterThanOrEqual(38);
  });
});

// ── getDNLCategory ────────────────────────────────────────────────────────────

describe('getDNLCategory', () => {
  test('DNL 40 → Very Quiet', () => {
    expect(getDNLCategory(40).label).toBe('Very Quiet');
  });

  test('DNL 50 → Quiet', () => {
    expect(getDNLCategory(50).label).toBe('Quiet');
  });

  test('DNL 60 → Moderate', () => {
    expect(getDNLCategory(60).label).toBe('Moderate');
  });

  test('DNL 67 → Elevated', () => {
    expect(getDNLCategory(67).label).toBe('Elevated');
  });

  test('DNL 75 → Significant', () => {
    expect(getDNLCategory(75).label).toBe('Significant');
  });

  test('returns label, color, hint', () => {
    const r = getDNLCategory(55);
    expect(r).toHaveProperty('label');
    expect(r).toHaveProperty('color');
    expect(r).toHaveProperty('hint');
  });
});

// ── estimateBortle ────────────────────────────────────────────────────────────

describe('estimateBortle', () => {
  test('null population + no landuse → Bortle 5 (suburban default)', () => {
    const r = estimateBortle(null, null);
    expect(r.bortle).toBe(5);
  });

  test('null population + commercial landuse → Bortle 7', () => {
    const r = estimateBortle(null, 'commercial');
    expect(r.bortle).toBe(7);
  });

  test('null population + rural landuse → Bortle 3', () => {
    const r = estimateBortle(null, 'rural');
    expect(r.bortle).toBe(3);
  });

  test('high population (>6000) → Bortle 7', () => {
    const r = estimateBortle(8000, null);
    expect(r.bortle).toBe(7);
  });

  test('low population (<400) → Bortle 3', () => {
    const r = estimateBortle(200, null);
    expect(r.bortle).toBe(3);
  });

  test('commercial landuse bumps Bortle up by 1', () => {
    const withoutCommercial = estimateBortle(1500, null);   // should be 5
    const withCommercial    = estimateBortle(1500, 'commercial'); // should be 6
    expect(withCommercial.bortle).toBe(withoutCommercial.bortle + 1);
  });

  test('rural landuse reduces Bortle by 1 when >4', () => {
    const withoutRural = estimateBortle(3500, null);    // should be 6
    const withRural    = estimateBortle(3500, 'rural'); // should be 5
    expect(withRural.bortle).toBe(withoutRural.bortle - 1);
  });

  test('result has bortle, label, desc', () => {
    const r = estimateBortle(1000, null);
    expect(r).toHaveProperty('bortle');
    expect(r).toHaveProperty('label');
    expect(r).toHaveProperty('desc');
  });
});

// ── getBortleDescription ──────────────────────────────────────────────────────

describe('getBortleDescription', () => {
  test('Bortle 1 → Exceptional dark sky', () => {
    expect(getBortleDescription(1).label).toBe('Exceptional dark sky');
  });

  test('Bortle 2 → Exceptional dark sky (boundary)', () => {
    expect(getBortleDescription(2).label).toBe('Exceptional dark sky');
  });

  test('Bortle 3 → Rural dark sky', () => {
    expect(getBortleDescription(3).label).toBe('Rural dark sky');
  });

  test('Bortle 5 → Suburban sky', () => {
    expect(getBortleDescription(5).label).toBe('Suburban sky');
  });

  test('Bortle 7 → Suburban/urban transition', () => {
    expect(getBortleDescription(7).label).toBe('Suburban/urban transition');
  });

  test('Bortle 8 → Urban sky', () => {
    expect(getBortleDescription(8).label).toBe('Urban sky');
  });

  test('returns label and desc', () => {
    const r = getBortleDescription(4);
    expect(r).toHaveProperty('label');
    expect(r).toHaveProperty('desc');
  });
});

// ── getRadonZone ──────────────────────────────────────────────────────────────

describe('getRadonZone', () => {
  test('null fips → null', () => {
    expect(getRadonZone(null)).toBeNull();
  });

  test('fips with no state → null', () => {
    expect(getRadonZone({})).toBeNull();
  });

  test('Kentucky (state "21") → returns a zone object', () => {
    const r = getRadonZone({ state: '21' });
    expect(r).not.toBeNull();
    expect(r).toHaveProperty('zone');
    expect([1, 2, 3]).toContain(r.zone);
  });

  test('unknown state → defaults to zone 2', () => {
    const r = getRadonZone({ state: '00' });
    expect(r.zone).toBe(2);
  });
});
