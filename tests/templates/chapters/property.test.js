'use strict';
const { buildPropertyIntelligenceHTML } = require('../../../src/templates/chapters/property');

const basePropIntel = {
  era: {
    medianYearBuilt: 1995,
    newConstructionPct: 8,
    context: {
      era: 'Late 20th-century construction (1980–1999)',
      cautions: ['Check for polybutylene plumbing', 'Inspect HVAC systems'],
    },
  },
  soil: {
    muname: 'Maury silt loam',
    drainagecl: 'Well drained',
    drainageCategory: { label: 'Well Drained', color: 'green', implication: 'Good drainage expected.' },
    isHydric: false,
  },
  broadband: {
    providers: [{ name: 'AT&T', tech: 'Fiber', download: 1000 }],
    maxDownloadMbps: 1000,
    hasFiber: true,
    category: { label: 'Excellent', color: 'green', desc: 'Gigabit fiber available.' },
  },
  locationInfo: { county: 'Scott County' },
};

describe('buildPropertyIntelligenceHTML — FR-045 glance bar', () => {
  test('renders chapter-glance in depth-l1', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntel);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance shows era label (first 4 words)', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntel);
    expect(html).toMatch(/Late 20th-century construction/);
  });

  test('glance shows drainage category label', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntel);
    expect(html).toMatch(/Well Drained/);
  });

  test('glance empty when no era or soil drainage', () => {
    const propIntel = {
      era: { medianYearBuilt: 1990, newConstructionPct: 5, context: null },
      soil: { muname: 'Urban land', drainageCategory: null, isHydric: false },
      broadband: null,
      locationInfo: { county: 'Scott County' },
    };
    const html = buildPropertyIntelligenceHTML(propIntel);
    // Should still render a chapter card (no glance bar) without error
    expect(html).toMatch(/chapter/);
    expect(html).not.toMatch(/chapter-glance/);
  });

  test('returns empty string when propIntel is null', () => {
    const html = buildPropertyIntelligenceHTML(null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntel);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
