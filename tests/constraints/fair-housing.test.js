'use strict';

// CONSTRAINT-002: Fair Housing — absolute.
// No finding may reference or imply racial, ethnic, national origin, income class,
// or demographic composition language. Income findings must compare to national
// median only — never characterize area economic class.

const { buildDemographicsHTML } = require('../../src/modules/community/template');

// Phrases that would violate Fair Housing. This list is illustrative — any
// demographic characterization of a neighborhood is a violation even if unlisted.
const FORBIDDEN_PATTERNS = [
  // demographic composition
  /predominantly\s+(white|black|hispanic|asian|latino|minority)/i,
  /majority\s+(white|black|hispanic|asian|latino|minority)/i,
  /largely\s+(white|black|hispanic|asian|latino|minority)/i,
  // direct class labels
  /\b(affluent|upscale|working.?class|lower.?class|upper.?class|ghetto|slum)\b/i,
  // neighborhood quality code words
  /good\s+neighborhood|bad\s+neighborhood|nice\s+area|rough\s+area/i,
  // direct income class characterization (not comparison to national median)
  /\b(poor|wealthy|rich|impoverished)\s+(neighborhood|area|community|tract)\b/i,
];

const minimalData = {
  age: { under18: 25, age18to34: 28, age35to64: 32, age65plus: 15, primaryGroup: 'Mixed age distribution' },
  medianAge: 38,
  income: {
    median: 65000,
    level: { label: 'Moderate', color: 'gold' },
  },
  education: {
    bachelor: 22,
    graduate: 10,
    collegePct: 32,
    level: { label: 'Average', color: 'green' },
  },
  community: {
    ownershipRate: 62,
    medianTenureYears: 8,
    type: { label: 'Suburban', icon: '🏘' },
    densityType: { label: 'Low-density', icon: '🌿' },
  },
};

test('buildDemographicsHTML output contains no Fair Housing violations', () => {
  const html = buildDemographicsHTML(minimalData);
  FORBIDDEN_PATTERNS.forEach((pattern) => {
    expect(html).not.toMatch(pattern);
  });
});

test('income narrative compares to national median, not area class labels', () => {
  const html = buildDemographicsHTML(minimalData);
  // Must reference national median comparison
  expect(html).toMatch(/national median/i);
  // Must NOT label the area as a class
  expect(html).not.toMatch(/\b(poor|wealthy|rich|impoverished)\s+(neighborhood|area|community|tract)\b/i);
});

test('buildDemographicsHTML returns empty string for null input', () => {
  expect(buildDemographicsHTML(null)).toBe('');
});
