'use strict';
const { getElectricRateContext } = require('../../../src/modules/utilities/logic');

describe('getElectricRateContext', () => {
  test('rate well below state avg -> below', () => {
    const r = getElectricRateContext(0.10, 'KY'); // avg 0.128
    expect(r.deltaLabel).toBe('below state average');
    expect(r.color).toBe('green');
    expect(r.stateAvg).toBe(0.128);
  });
  test('rate within +/-7% -> near', () => {
    const r = getElectricRateContext(0.128, 'KY');
    expect(r.deltaLabel).toBe('near state average');
    expect(r.color).toBe('gold');
  });
  test('rate well above state avg -> above', () => {
    const r = getElectricRateContext(0.20, 'KY');
    expect(r.deltaLabel).toBe('above state average');
    expect(r.color).toBe('orange');
  });
  test('returns null when rate missing', () => {
    expect(getElectricRateContext(null, 'KY')).toBeNull();
    expect(getElectricRateContext(0, 'KY')).toBeNull();
  });
  test('returns null when state has no average', () => {
    expect(getElectricRateContext(0.12, 'ZZ')).toBeNull();
  });
  test('narrative is a non-empty string with no numeric grade words', () => {
    const r = getElectricRateContext(0.10, 'KY');
    expect(typeof r.narrative).toBe('string');
    expect(r.narrative.length).toBeGreaterThan(0);
    expect(r.narrative.toLowerCase()).not.toMatch(/score|grade|rating|out of/);
  });
});
