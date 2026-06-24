'use strict';

// FR-093 — costs logic (pure computeCosts). Last numbered chapter -> contract (rollout #14).

const { computeCosts, REFERENCE_PRICE } = require('../../../src/modules/costs/logic');

// getPropertyData output shape: { taxRate, insuranceYear, utilitiesMo, homesteadNote, state, county, densityLabel }
const ky = { taxRate: 0.83, insuranceYear: 1680, utilitiesMo: 190, homesteadNote: 'KY note', state: 'KY' };
const nj = { taxRate: 2.13, insuranceYear: 1440, utilitiesMo: 210, homesteadNote: null, state: 'NJ' };
const near = { taxRate: 1.0, insuranceYear: 1400, utilitiesMo: 185, homesteadNote: null, state: 'XX' };

describe('computeCosts (AC-1)', () => {
  test('null / undefined in -> null out', () => {
    expect(computeCosts(null)).toBeNull();
    expect(computeCosts(undefined)).toBeNull();
  });

  test('reference price is $300k', () => {
    expect(REFERENCE_PRICE).toBe(300000);
    expect(computeCosts(ky).referencePrice).toBe(300000);
  });

  test('monthly carrying math (KY): tax+insurance+utilities at $300k', () => {
    const c = computeCosts(ky);
    expect(c.monthly.tax).toBe(208);          // round(300000 * 0.83/100 / 12) = round(207.5)
    expect(c.monthly.insurance).toBe(140);    // round(1680 / 12)
    expect(c.monthly.utilities).toBe(190);
    expect(c.monthly.total).toBe(538);        // 208 + 140 + 190
  });

  test('is pure: returns a plain object, no HTML, no functions', () => {
    const c = computeCosts(ky);
    expect(typeof c).toBe('object');
    expect(JSON.stringify(c)).not.toContain('<');
    for (const v of Object.values(c)) expect(typeof v).not.toBe('function');
  });
});

describe('computeCosts — tax comparison bands (AC-10)', () => {
  test('below: KY 0.83 -> below, deltaPct -17, referenceValue 1.0', () => {
    const t = computeCosts(ky).taxComparison;
    expect(t.direction).toBe('below');
    expect(t.deltaPct).toBe(-17);
    expect(t.referenceValue).toBe(1.0);
  });

  test('near: 1.0 -> near, deltaPct 0', () => {
    const t = computeCosts(near).taxComparison;
    expect(t.direction).toBe('near');
    expect(t.deltaPct).toBe(0);
  });

  test('above: NJ 2.13 -> above, deltaPct 113', () => {
    const t = computeCosts(nj).taxComparison;
    expect(t.direction).toBe('above');
    expect(t.deltaPct).toBe(113);
  });

  test('band edges: 0.9 -> below, 1.1 -> above', () => {
    expect(computeCosts({ ...near, taxRate: 0.9 }).taxComparison.direction).toBe('below');
    expect(computeCosts({ ...near, taxRate: 1.1 }).taxComparison.direction).toBe('above');
  });
});
