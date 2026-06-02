'use strict';
const { buildGrowthAndDevelopmentHTML } = require('../../../src/modules/growth/template');

const baseGrowth = {
  namedProjects: [
    { name: 'Georgetown Commons Retail Center', type: 'Commercial', status: 'Approved', icon: '🏪', impact: 'New retail development adding 40,000 sq ft of commercial space.', automated: false },
    { name: 'Maplewood Subdivision Phase 2', type: 'Residential', status: 'Under Construction', icon: '🏗️', impact: '120-unit residential development expected to complete in 2026.', automated: false },
  ],
  permits: null,
  newConstruction: null,
  establishments: [],
  locationInfo: { county: 'Scott County', city: 'Georgetown' },
};

const fullGrowth = {
  namedProjects: [
    { name: 'Georgetown Commons Retail Center', type: 'Commercial', status: 'Approved', icon: '🏪', impact: 'New retail development.', automated: false },
    { name: 'Maplewood Subdivision Phase 2', type: 'Residential', status: 'Under Construction', icon: '🏗️', impact: '120-unit residential.', automated: false, expectedOpening: '2026' },
  ],
  permits: { current: 1234, currentYear: 2023, priorYear: 2022, trend: 'rising', percentChange: 15 },
  newConstruction: null,
  establishments: [
    { name: 'Walmart Supercenter', icon: '🛒', label: 'Grocery', distanceMiles: 0.4 },
    { name: 'CVS Pharmacy', icon: '💊', label: 'Pharmacy', distanceMiles: 0.6 },
  ],
  locationInfo: { county: 'Scott County', city: 'Georgetown' },
};

describe('buildGrowthAndDevelopmentHTML — FR-045 glance bar', () => {
  test('renders chapter-glance in depth-l1', () => {
    const html = buildGrowthAndDevelopmentHTML(baseGrowth);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance lists named project names', () => {
    const html = buildGrowthAndDevelopmentHTML(baseGrowth);
    expect(html).toMatch(/Georgetown Commons Retail Center/);
  });

  test('glance shows fallback text when no named projects', () => {
    const growth = { ...baseGrowth, namedProjects: [] };
    const html = buildGrowthAndDevelopmentHTML(growth);
    expect(html).toMatch(/No confirmed development projects nearby/);
  });

  test('returns empty string when growth is null', () => {
    const html = buildGrowthAndDevelopmentHTML(null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildGrowthAndDevelopmentHTML(baseGrowth);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildGrowthAndDevelopmentHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/depth-l3/);
  });

  test('growth-deep-dive container rendered', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/growth-deep-dive/);
  });

  test('Permit Trends tab rendered', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Permit Trends/);
  });

  test('permit count shown when permits available', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/1,234/);
  });

  test('percent change shown when permits available', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/15%/);
  });

  test('new construction pct shown when no permits but newConstruction', () => {
    const g = { ...fullGrowth, permits: null, newConstruction: { newConstructionPct: 22 } };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).toMatch(/22%/);
  });

  test('fallback text shown when no permits and no newConstruction', () => {
    const g = { ...fullGrowth, permits: null, newConstruction: null };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).toMatch(/Planning and Zoning/i);
  });

  test('Research Guide tab rendered', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Research Guide/);
  });

  test('county name used in research guide', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Scott County/);
  });

  test('L3 present even when no named projects', () => {
    const g = { ...fullGrowth, namedProjects: [] };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).toMatch(/depth-l3/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
