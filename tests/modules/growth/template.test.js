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

describe('buildGrowthAndDevelopmentHTML — commercial provenance label (FR-071)', () => {
  test('Google-sourced establishments label as Google Places', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Google Places/);
    expect(html).not.toMatch(/OpenStreetMap/);
  });

  test('OSM-fallback establishments relabel as OpenStreetMap (honest provenance)', () => {
    const growth = {
      ...fullGrowth,
      establishments: [{ name: 'Regional Mall', icon: '🏬', label: 'Shopping Center', distanceMiles: 0.3, source: 'osm' }],
    };
    const html = buildGrowthAndDevelopmentHTML(growth);
    expect(html).toMatch(/OpenStreetMap/);
  });
});

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

describe('buildGrowthAndDevelopmentHTML — L4 research', () => {
  test('depth-l4 wrapper present when named projects exist', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/depth-l4/);
  });

  test('named projects table rendered', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/climate-data-table/);
  });

  test('named project names appear in table', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Georgetown Commons Retail Center/);
    expect(html).toMatch(/Maplewood Subdivision Phase 2/);
  });

  test('project status appears in table', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Under Construction/);
    expect(html).toMatch(/Approved/);
  });

  test('expected opening shown when available', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/2026/);
  });

  test('establishments table rendered when establishments present', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Walmart Supercenter/);
    expect(html).toMatch(/CVS Pharmacy/);
  });

  test('L4 absent when no named projects and no establishments', () => {
    const g = { ...fullGrowth, namedProjects: [], establishments: [] };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).not.toMatch(/depth-l4/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildGrowthAndDevelopmentHTML — 10-Year Horizon', () => {
  test('horizon section rendered when rising permits', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/prem-growth-horizon/);
    expect(html).toMatch(/10-Year Outlook/);
  });

  test('horizon includes rising permit percentage', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/15%/);
  });

  test('horizon includes named project when under construction', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Maplewood Subdivision Phase 2/);
  });

  test('horizon absent when no permits and no newConstruction and no namedProjects', () => {
    const g = { ...baseGrowth, namedProjects: [], permits: null, newConstruction: null };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).not.toMatch(/prem-growth-horizon/);
  });

  test('horizon present when only newConstruction available', () => {
    const g = { ...baseGrowth, namedProjects: [], permits: null, newConstruction: { newConstructionPct: 22 } };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).toMatch(/prem-growth-horizon/);
    expect(html).toMatch(/22%/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('declining permits produce cooling framing', () => {
    const g = { ...fullGrowth, permits: { current: 900, currentYear: 2023, priorYear: 2022, trend: 'declining', percentChange: -20 } };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).toMatch(/prem-growth-horizon/);
    expect(html).toMatch(/20%/);
  });
});
