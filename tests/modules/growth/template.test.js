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
