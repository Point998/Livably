'use strict';
const { buildDemographicsHTML } = require('../../../src/templates/chapters/community');

const baseDemographics = {
  age: {
    under18: 22,
    age18to34: 25,
    age35to64: 38,
    age65plus: 15,
    primaryGroup: 'Working-age adults (35–64)',
  },
  medianAge: 38,
  income: {
    median: 72000,
    level: { label: 'Near National Median', color: 'gold' },
  },
  education: {
    bachelor: 32,
    graduate: 14,
    collegePct: 46,
    level: { label: 'College-educated majority', color: 'green' },
  },
  community: {
    ownershipRate: 68,
    medianTenureYears: 9,
    avgHHSize: 2.6,
    type: { label: 'Mixed Owner/Renter', icon: '🏠' },
    densityType: { label: 'Suburban', icon: '🏘️' },
  },
};

describe('buildDemographicsHTML — FR-045 glance bar', () => {
  test('renders chapter-glance in depth-l1', () => {
    const html = buildDemographicsHTML(baseDemographics);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance shows ownership rate', () => {
    const html = buildDemographicsHTML(baseDemographics);
    expect(html).toMatch(/68% owner-occupied/);
  });

  test('glance shows median tenure', () => {
    const html = buildDemographicsHTML(baseDemographics);
    expect(html).toMatch(/9-yr tenure/);
  });

  test('glance shows income level label', () => {
    const html = buildDemographicsHTML(baseDemographics);
    expect(html).toMatch(/Near National Median/);
  });

  test('returns empty string when demographics is null', () => {
    const html = buildDemographicsHTML(null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildDemographicsHTML(baseDemographics);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
