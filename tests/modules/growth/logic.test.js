'use strict';

const { calcPermitPercentChange, classifyPermitTrend } = require('../../../src/modules/growth/logic');

describe('calcPermitPercentChange', () => {
  test('returns null when prior is null', () => {
    expect(calcPermitPercentChange(100, null)).toBeNull();
  });

  test('returns null when prior is zero', () => {
    expect(calcPermitPercentChange(100, 0)).toBeNull();
  });

  test('calculates increase correctly', () => {
    // (110 - 100) / 100 * 100 = 10
    expect(calcPermitPercentChange(110, 100)).toBe(10);
  });

  test('calculates decrease correctly', () => {
    // (90 - 100) / 100 * 100 = -10
    expect(calcPermitPercentChange(90, 100)).toBe(-10);
  });

  test('rounds to nearest integer', () => {
    // (105 - 100) / 100 * 100 = 5, rounded = 5
    expect(calcPermitPercentChange(105, 100)).toBe(5);
    // (103 - 100) / 100 * 100 = 3, rounded = 3
    expect(calcPermitPercentChange(103, 100)).toBe(3);
  });
});

describe('classifyPermitTrend', () => {
  test('returns stable when percentChange is null', () => {
    expect(classifyPermitTrend(null)).toBe('stable');
  });

  test('returns rising at exactly 10%', () => {
    expect(classifyPermitTrend(10)).toBe('rising');
  });

  test('returns rising above 10%', () => {
    expect(classifyPermitTrend(25)).toBe('rising');
  });

  test('returns declining at exactly -10%', () => {
    expect(classifyPermitTrend(-10)).toBe('declining');
  });

  test('returns declining below -10%', () => {
    expect(classifyPermitTrend(-30)).toBe('declining');
  });

  test('returns stable between -10 and 10 exclusive', () => {
    expect(classifyPermitTrend(0)).toBe('stable');
    expect(classifyPermitTrend(9)).toBe('stable');
    expect(classifyPermitTrend(-9)).toBe('stable');
  });
});
