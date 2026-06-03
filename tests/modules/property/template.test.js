'use strict';
const { buildPropertyIntelligenceHTML } = require('../../../src/modules/property/template');

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

const basePropIntelWithBands = {
  ...basePropIntel,
  broadband: {
    providers: [
      { name: 'AT&T', tech: 'Fiber', download: 1000, upload: 500 },
      { name: 'Spectrum', tech: 'Cable', download: 200, upload: 20 },
    ],
    maxDownloadMbps: 1000,
    hasFiber: true,
    category: { label: 'Excellent', color: 'green', desc: 'Gigabit fiber available.' },
  },
  housingAgeBands: {
    totalUnits: 1000,
    bands: [
      { label: '2010+',    count: 200, pct: 20 },
      { label: '2000s',    count: 200, pct: 20 },
      { label: '1990s',    count: 180, pct: 18 },
      { label: '1980s',    count: 150, pct: 15 },
      { label: '1970s',    count: 100, pct: 10 },
      { label: '1960s',    count: 70,  pct:  7 },
      { label: 'Pre-1960', count: 100, pct: 10 },
    ],
  },
};

describe('buildPropertyIntelligenceHTML — L3 deep dive', () => {
  test('renders depth-l3 container', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/depth-l3/);
  });

  test('renders Internet Providers tab button', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Internet Providers/);
  });

  test('renders Soil tab button', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Soil.*Foundation|Foundation.*Soil/);
  });

  test('renders Building Age tab button', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Building Age/);
  });

  test('shows upload speed arrow in broadband tab', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/↑/);
  });

  test('shows remote work note when upload >= 100 Mbps', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/remote work/i);
  });

  test('does not show remote work note when no provider has upload >= 100 Mbps', () => {
    const lowUpload = {
      ...basePropIntelWithBands,
      broadband: {
        ...basePropIntelWithBands.broadband,
        providers: [{ name: 'Spectrum', tech: 'Cable', download: 200, upload: 20 }],
      },
    };
    const html = buildPropertyIntelligenceHTML(lowUpload);
    // The L2 body may mention "remote work" in the category desc — check the L3 tab specifically
    // We verify by ensuring upload IS shown (↑ arrow) but NOT the specific remote-work note
    expect(html).toMatch(/↑/); // upload speed still shown
    expect(html).not.toMatch(/At least one provider offers upload speeds of 100 Mbps or higher/);
  });

  test('shows hydric badge when isHydric is true', () => {
    const hydricIntel = {
      ...basePropIntelWithBands,
      soil: { ...basePropIntel.soil, isHydric: true, hydricrating: 'Yes' },
    };
    const html = buildPropertyIntelligenceHTML(hydricIntel);
    expect(html).toMatch(/Hydric/);
    expect(html).toMatch(/Wetland Indicator/);
  });

  test('shows decade bar for 2010+', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/2010\+/);
  });

  test('shows Pre-1960 band', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Pre-1960/);
  });

  test('shows era risk note for 1980s band (15% > 5% threshold)', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/[Pp]olybutylene/);
  });

  test('does not show 1980s era risk note when band is below 5% threshold', () => {
    const lowThreshold = {
      ...basePropIntelWithBands,
      housingAgeBands: {
        ...basePropIntelWithBands.housingAgeBands,
        bands: basePropIntelWithBands.housingAgeBands.bands.map(b =>
          b.label === '1980s' ? { ...b, pct: 3 } : b
        ),
      },
    };
    const html = buildPropertyIntelligenceHTML(lowThreshold);
    // The old band-threshold era note (prem-intel-era-note class) should not contain the 1980s
    // band risk text when the 1980s band is below the 5% threshold.
    // Note: the new era health risks section (prem-intel-era-risk-item) may still mention
    // Polybutylene based on medianYearBuilt — this test is scoped to the band-threshold note only.
    expect(html).not.toMatch(/recalled for failure risk/);
  });

  test('shows median year note when era.medianYearBuilt is set', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Median year built.*1995|1995.*[Mm]edian/);
  });

  test('graceful fallback when housingAgeBands is null', () => {
    const noBands = { ...basePropIntelWithBands, housingAgeBands: null };
    const html = buildPropertyIntelligenceHTML(noBands);
    expect(html).toMatch(/depth-l3/); // still renders L3
    expect(html).toMatch(/data was not available/i); // fallback message
  });

  test('graceful fallback when soil is null', () => {
    const noSoil = { ...basePropIntelWithBands, soil: null };
    const html = buildPropertyIntelligenceHTML(noSoil);
    expect(html).toMatch(/depth-l3/);
    expect(html).toMatch(/not available/i);
  });

  test('graceful fallback when broadband is null', () => {
    const noBroadband = { ...basePropIntelWithBands, broadband: null };
    const html = buildPropertyIntelligenceHTML(noBroadband);
    expect(html).toMatch(/depth-l3/);
    expect(html).toMatch(/FCC National Broadband Map/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildPropertyIntelligenceHTML — L4 research', () => {
  test('renders depth-l4 container', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/depth-l4/);
  });

  test('renders provider table with Download and Upload column headers', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Download.*Upload|Upload.*Download/);
  });

  test('renders USDA soil reference section', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/USDA Soil Reference/);
  });

  test('renders housing age raw counts table', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Housing Age Distribution/);
  });

  test('renders county assessor link', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/Scott County.*Assessor|Assessor.*Scott County/);
  });

  test('renders FCC broadband map link', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/broadbandmap\.fcc\.gov/);
  });

  test('renders county records links section even when all data is null', () => {
    const noData = {
      ...basePropIntelWithBands,
      broadband: null,
      soil: null,
      housingAgeBands: null,
    };
    const html = buildPropertyIntelligenceHTML(noData);
    expect(html).toMatch(/depth-l4/);
    expect(html).toMatch(/County Records/);
  });

  test('renders Total row in housing age table', () => {
    const html = buildPropertyIntelligenceHTML(basePropIntelWithBands);
    expect(html).toMatch(/<strong>Total<\/strong>/);
  });
});

describe('buildPropertyIntelligenceHTML — era health risks', () => {
  test('era risk section absent for modern home (2010)', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 2010, newConstructionPct: 40, context: { era: 'Modern', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).not.toMatch(/prem-intel-era-risks/);
  });

  test('era risk section present for 1970s home', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 1972, newConstructionPct: 0, context: { era: '1960s–70s', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).toMatch(/prem-intel-era-risks/);
  });

  test('lead paint risk shown for pre-1978 home', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 1965, newConstructionPct: 0, context: { era: '1960s–70s', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).toMatch(/[Ll]ead paint/);
  });

  test('polybutylene risk shown for 1985 home', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 1985, newConstructionPct: 0, context: { era: '1980s', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).toMatch(/[Pp]olybutylene/);
  });

  test('pre-1940 home shows lead paint and asbestos and plumbing risks', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 1935, newConstructionPct: 0, context: { era: 'Pre-1940', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).toMatch(/[Ll]ead paint/);
    expect(html).toMatch(/[Aa]sbestos/);
    expect(html).toMatch(/[Pp]lumbing/);
  });

  test('era risk absent when era is null', () => {
    const p = { ...basePropIntel, era: null };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).not.toMatch(/prem-intel-era-risks/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 1965, newConstructionPct: 0, context: { era: '1960s–70s', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
