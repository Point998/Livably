'use strict';
const { computeSourceVerdict, computeExitCode } = require('../scripts/lib/verdict');

const cells = (...outcomes) => outcomes.map((outcome) => ({ outcome }));

describe('computeSourceVerdict', () => {
  test("coverage 'all' dead-at-one → FAIL", () => {
    expect(computeSourceVerdict('all', cells('OK', 'FAIL', 'OK'))).toBe('FAIL');
  });
  test("coverage 'all' all-OK → PASS", () => {
    expect(computeSourceVerdict('all', cells('OK', 'OK'))).toBe('PASS');
  });
  test("coverage 'some' dead-at-all → FAIL", () => {
    expect(computeSourceVerdict('some', cells('FAIL', 'FAIL'))).toBe('FAIL');
  });
  test("coverage 'some' partial → INFO", () => {
    expect(computeSourceVerdict('some', cells('OK', 'FAIL'))).toBe('INFO');
  });
  test("coverage 'some' all-OK → PASS", () => {
    expect(computeSourceVerdict('some', cells('OK', 'OK'))).toBe('PASS');
  });
  test('all cells skipped → SKIPPED', () => {
    expect(computeSourceVerdict('all', cells('SKIPPED', 'SKIPPED'))).toBe('SKIPPED');
  });
  test('skipped cells excluded from denominator', () => {
    expect(computeSourceVerdict('all', cells('SKIPPED', 'OK'))).toBe('PASS');
  });
});

describe('computeExitCode', () => {
  test('1 when any verdict is FAIL', () => {
    expect(computeExitCode(['PASS', 'INFO', 'FAIL'])).toBe(1);
  });
  test('0 when no FAIL', () => {
    expect(computeExitCode(['PASS', 'INFO', 'SKIPPED'])).toBe(0);
  });
});
