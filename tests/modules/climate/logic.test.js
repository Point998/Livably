'use strict';
const { getSeismicContext } = require('../../../src/modules/climate/logic');

describe('getSeismicContext', () => {
  const ctx = (pga) => getSeismicContext({ pga, ss: 0.5, s1: 0.2, sds: 0.4 });

  test('PGA band boundaries map per PGA_BAND_THRESHOLDS', () => {
    expect(ctx(0.04).band).toBe('very-low');
    expect(ctx(0.05).band).toBe('low');
    expect(ctx(0.084).band).toBe('low');
    expect(ctx(0.10).band).toBe('moderate');
    expect(ctx(0.15).band).toBe('moderate');
    expect(ctx(0.30).band).toBe('high');
    expect(ctx(0.40).band).toBe('very-high');
    expect(ctx(0.9).band).toBe('very-high');
  });

  test('promote is true only for moderate and above', () => {
    expect(ctx(0.084).promote).toBe(false);
    expect(ctx(0.04).promote).toBe(false);
    expect(ctx(0.15).promote).toBe(true);
    expect(ctx(0.30).promote).toBe(true);
    expect(ctx(0.5).promote).toBe(true);
  });

  test('carries through values, label, color; narrative mentions the pga and no score words', () => {
    const r = ctx(0.30);
    expect(r.pga).toBe(0.30);
    expect(r.ss).toBe(0.5);
    expect(r.color).toBe('orange');
    expect(r.label).toMatch(/High seismic hazard/);
    expect(typeof r.narrative).toBe('string');
    expect(r.narrative).toMatch(/0\.30g/);
    expect(r.narrative.toLowerCase()).not.toMatch(/score|grade|rating|out of/);
  });

  test('returns null for missing/invalid input', () => {
    expect(getSeismicContext(null)).toBeNull();
    expect(getSeismicContext({})).toBeNull();
    expect(getSeismicContext({ pga: 0 })).toBeNull();
    expect(getSeismicContext({ pga: 'x' })).toBeNull();
  });
});
