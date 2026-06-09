'use strict';
const { buildClimateChapterHTML } = require('../../../src/modules/climate/template');

const baseEnv = {
  floodRisk: { zone: 'X', risk: 'Minimal', insuranceRequired: false },
};
const locationInfo = { state: 'KY', county: 'Scott County', zip: '40324' };

const baseHistory = {
  stormEvents: {
    tornadoes: [{ begin_date: '2012-03-02', event_type: 'Tornado', magnitude: 1, magnitude_type: 'EF', deaths_direct: 0, injuries_direct: 2, damage_property: 250000, begin_lat: 38.25, begin_lon: -84.55 }],
    floods: [],
    winterStorms: [{ begin_date: '2021-02-11', event_type: 'Ice Storm', magnitude: null, damage_property: 500000 }],
    heatEvents: [],
    allEvents: [],
  },
  femaDeclarations: {
    weatherRelated: [{ declarationDate: '2021-02-15', declarationTitle: 'Severe Ice Storm', incidentType: 'Ice Storm' }],
    all: [],
    count: 1,
  },
  climateNormals: {
    monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, tMaxF: 50 + i * 3, tMinF: 30 + i * 2, precipIn: 3.5, snowIn: i < 3 || i > 9 ? 2 : 0 })),
    annual: { daysAbove90: 26, daysAbove95: 8, daysBelow32: 74 },
    stationId: 'GHCND:USW00093820',
    stationName: 'Georgetown KY',
  },
  glance: { lastSignificantEvent: { type: 'Ice Storm', year: 2021 } },
  preparedness: {
    emergencySystem: { tier: 1, name: 'KYEM Alert', url: 'https://kyem.ky.gov/alert', searchUrl: 'https://google.com/search?q=Scott+County+emergency+alerts', note: null },
    roadPriority: 'residential',
  },
  watershed: { topographicPosition: 'midslope', elevations: [900, 920, 880, 910, 890] },
  basementContext: 'Homes of this era vary significantly — some have basements, many are slab.',
};

describe('buildClimateChapterHTML', () => {
  test('renders without climateHistory (backward compatible)', () => {
    const html = buildClimateChapterHTML(baseEnv, null, locationInfo);
    expect(html).toBeTruthy();
    expect(html).toMatch(/Zone X/);
  });

  test('renders with no arguments without crashing', () => {
    expect(() => buildClimateChapterHTML(null, null, null)).not.toThrow();
  });

  test('Glance bar renders when climateHistory present', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/climate-glance/);
  });

  test('Glance bar shows last significant event year and type', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/Ice Storm/);
    expect(html).toMatch(/2021/);
  });

  test('Glance bar shows "no disasters" text when lastSignificantEvent is null', () => {
    const h = { ...baseHistory, glance: { lastSignificantEvent: null } };
    const html = buildClimateChapterHTML(baseEnv, h, locationInfo);
    expect(html).toMatch(/No federally declared/i);
  });

  test('Overview shows FEMA declaration count when count > 0', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/1 federal.*disaster declaration/i);
  });

  test('Overview omits FEMA sentence when count is 0', () => {
    const h = { ...baseHistory, femaDeclarations: { ...baseHistory.femaDeclarations, count: 0, weatherRelated: [] } };
    const html = buildClimateChapterHTML(baseEnv, h, locationInfo);
    expect(html).not.toMatch(/federal.*disaster declaration/i);
  });

  test('watershed lowpoint shows Things to Check note', () => {
    const h = { ...baseHistory, watershed: { topographicPosition: 'lowpoint', elevations: [850, 920, 910, 900, 890] } };
    const html = buildClimateChapterHTML(baseEnv, h, locationInfo);
    expect(html).toMatch(/low point/i);
  });

  test('watershed uphill shows reassuring note', () => {
    const h = { ...baseHistory, watershed: { topographicPosition: 'uphill', elevations: [950, 880, 870, 900, 890] } };
    const html = buildClimateChapterHTML(baseEnv, h, locationInfo);
    expect(html).toMatch(/above.*terrain|drains away/i);
  });

  test('no scoring CSS classes (CONSTRAINT-001)', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).not.toMatch(/class="[^"]*\bscore\b/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildClimateChapterHTML — Level 3 Deep Read', () => {
  test('Deep Read section renders when climateHistory present', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/climate-deep-dive/);
    expect(html).toMatch(/weather history/i);
  });

  test('Deep Read has exactly 6 tab buttons', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    const tabs = (html.match(/role="tab"/g) || []).length;
    expect(tabs).toBe(6);
  });

  test('Flood History tab panel exists', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/ctab-flood/);
  });

  test('Tornado tab contains EF rating from pre-cached event', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/ctab-tornado/);
    expect(html).toMatch(/EF1/i);
  });

  test('Community Preparedness tab shows KYEM Alert', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/KYEM Alert/);
    expect(html).toMatch(/kyem\.ky\.gov/);
  });

  test('Seasonal calendar renders all 12 months', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/JANUARY/);
    expect(html).toMatch(/DECEMBER/);
  });

  test('No Deep Read section when climateHistory is null', () => {
    const html = buildClimateChapterHTML(baseEnv, null, locationInfo);
    expect(html).not.toMatch(/climate-deep-dive/);
  });
});

describe('buildClimateChapterHTML — Level 4 Research', () => {
  test('Research tables present when allEvents is non-empty', () => {
    const h = {
      ...baseHistory,
      stormEvents: { ...baseHistory.stormEvents, allEvents: [{ begin_date: '2021-02-11', event_type: 'Ice Storm', damage_property: 500000 }] },
    };
    const html = buildClimateChapterHTML(baseEnv, h, locationInfo);
    expect(html).toMatch(/climate-research-section/);
  });

  test('Research section absent when allEvents is empty and no normals and no watershed', () => {
    const h = {
      ...baseHistory,
      climateNormals: null,
      watershed: null,
    };
    const html = buildClimateChapterHTML(baseEnv, h, locationInfo);
    expect(html).not.toMatch(/climate-research-section/);
  });

  test('Research normals section renders when allEvents is empty but normals are present', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/climate-research-section/);
    expect(html).toMatch(/30-Year Monthly Climate Normals/);
  });
});

function climateHistoryWith(named) {
  return {
    stormEvents: { tornadoes: [], floods: [], winterStorms: [], heatEvents: [], allEvents: [] },
    femaDeclarations: { weatherRelated: [], all: [], count: 0 },
    climateNormals: null,
    glance: { lastSignificantEvent: null },
    preparedness: { emergencySystem: null, roadPriority: null },
    watershed: named ? { topographicPosition: 'lowpoint', elevations: null, named } : null,
    basementContext: null,
  };
}

describe('L3 Your Watershed group', () => {
  const env = { floodRisk: { zone: 'X', risk: 'Minimal' } };

  test('renders the watershed name in the deep dive when named is present', () => {
    const html = buildClimateChapterHTML(env, climateHistoryWith({ huc12Name: 'Dry Run-North Elkhorn Creek', basinName: 'North Fork Elkhorn Creek' }), { state: 'KY', county: 'Scott County' });
    expect(html).toContain('Your Watershed');
    expect(html).toContain('Dry Run');
  });

  test('omits the Your Watershed group when named is absent', () => {
    const html = buildClimateChapterHTML(env, climateHistoryWith(null), { state: 'KY', county: 'Scott County' });
    expect(html).not.toContain('Your Watershed');
  });
});

describe('buildClimateChapterHTML — FR-045 depth system', () => {
  test('renders depth-l1 glance bar', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/climate-glance/);
  });

  test('chapter-body has depth-l2 class (via renderChapterCard)', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/chapter-body depth-l2/);
  });

  test('L3 deep dive content is wrapped in depth-l3', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/depth-l3/);
    expect(html).toMatch(/climate-deep-dive/);
  });

  test('no climate-deep-toggle button (replaced by depth selector)', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).not.toMatch(/climate-deep-toggle/);
  });

  test('no climate-research-toggle button (replaced by depth selector)', () => {
    const h = {
      ...baseHistory,
      stormEvents: { ...baseHistory.stormEvents, allEvents: [{ begin_date: '2021-02-11', event_type: 'Ice Storm', damage_property: 500000 }] },
    };
    const html = buildClimateChapterHTML(baseEnv, h, locationInfo);
    expect(html).not.toMatch(/climate-research-toggle/);
  });

  test('L4 research tables wrapped in depth-l4 when events present', () => {
    const h = {
      ...baseHistory,
      stormEvents: { ...baseHistory.stormEvents, allEvents: [{ begin_date: '2021-02-11', event_type: 'Ice Storm', damage_property: 500000 }] },
    };
    const html = buildClimateChapterHTML(baseEnv, h, locationInfo);
    expect(html).toMatch(/depth-l4/);
  });

  test('depth selector rendered (chapter-depth-control)', () => {
    const html = buildClimateChapterHTML(baseEnv, baseHistory, locationInfo);
    expect(html).toMatch(/chapter-depth-control/);
  });
});

describe('L4 Watershed Context block', () => {
  const env = { floodRisk: { zone: 'X', risk: 'Minimal' } };
  const named = { huc12Name: 'Dry Run-North Elkhorn Creek', basinName: 'North Fork Elkhorn Creek' };

  function historyWith(named, position) {
    const h = climateHistoryWith(named);
    if (h.watershed) h.watershed.topographicPosition = position;
    return h;
  }

  test('renders watershed meaning, basin, and lowpoint tie-back', () => {
    const html = buildClimateChapterHTML(env, historyWith(named, 'lowpoint'), { state: 'KY', county: 'Scott County' });
    expect(html).toContain('Watershed Context');
    expect(html).toContain('North Fork Elkhorn Creek'); // basin
    expect(html).toMatch(/drainage|drains|runoff/i);    // tie-back present
  });

  test('omits the basin clause when basinName is null', () => {
    const html = buildClimateChapterHTML(env, historyWith({ huc12Name: 'Dry Run-North Elkhorn Creek', basinName: null }, 'lowpoint'), { state: 'KY', county: 'Scott County' });
    expect(html).toContain('Watershed Context');
    expect(html).not.toContain('part of the larger');
  });

  test('uses uphill wording for an uphill parcel, not low-point language', () => {
    const html = buildClimateChapterHTML(env, historyWith(named, 'uphill'), { state: 'KY', county: 'Scott County' });
    expect(html).toMatch(/above the surrounding terrain|away from/i);
    expect(html).not.toMatch(/low-lying position/i);
  });

  test('renders the watershed block even with no storm events', () => {
    // climateHistoryWith already has empty allEvents; the block must still appear.
    const html = buildClimateChapterHTML(env, historyWith(named, 'neutral'), { state: 'KY', county: 'Scott County' });
    expect(html).toContain('Watershed Context');
  });

  test('omits the watershed block when named is absent', () => {
    const html = buildClimateChapterHTML(env, climateHistoryWith(null), { state: 'KY', county: 'Scott County' });
    expect(html).not.toContain('Watershed Context');
  });

  test('the watershed block contains no inline styles', () => {
    const html = buildClimateChapterHTML(env, historyWith(named, 'lowpoint'), { state: 'KY', county: 'Scott County' });
    const block = html.slice(html.indexOf('Watershed Context'));
    expect(block).not.toMatch(/style="/);
  });
});

const { buildClimateChapterHTML: buildCC } = require('../../../src/modules/climate/template');

const seisEnv = { floodRisk: { zone: 'X', risk: 'Minimal', insuranceRequired: false, description: 'x' } };
const seisLoc = { state: 'MT', county: 'Gallatin' };
const seisHistory = (band, promote, color) => ({
  stormEvents: { tornadoes: [], floods: [], winterStorms: [], heatEvents: [], allEvents: [] },
  femaDeclarations: { weatherRelated: [], all: [], count: 0 },
  climateNormals: null, preparedness: {}, basementContext: null, watershed: null,
  glance: { lastSignificantEvent: null },
  seismic: { pga: 0.30, ss: 0.68, s1: 0.213, sds: 0.569, band, label: `${band} seismic hazard`, color, promote, narrative: `USGS models ${band} ground motion ~0.30g.` },
});

describe('Climate seismic placement', () => {
  test('L2 promoted row appears when promote=true (moderate+)', () => {
    const html = buildCC(seisEnv, seisHistory('high', true, 'orange'), seisLoc);
    expect(html).toMatch(/Earthquake Risk/);
    expect(html).toContain('prem-climate-row');
  });
  test('L2 row absent when promote=false (low), but L3 Earthquake tab still present', () => {
    const html = buildCC(seisEnv, seisHistory('low', false, 'green'), seisLoc);
    expect(html).not.toMatch(/Earthquake Risk/);
    expect(html).toMatch(/id="ctab-seismic"/);
  });
  test('L4 design-values table present when seismic present', () => {
    const html = buildCC(seisEnv, seisHistory('high', true, 'orange'), seisLoc);
    expect(html).toMatch(/Seismic Design Values/);
    expect(html.toLowerCase()).toContain('peak ground acceleration');
  });
  test('no seismic -> no tab, no row, no table', () => {
    const noSeis = seisHistory('high', true, 'orange'); delete noSeis.seismic;
    const html = buildCC(seisEnv, noSeis, seisLoc);
    expect(html).not.toMatch(/ctab-seismic/);
    expect(html).not.toMatch(/Seismic Design Values/);
  });
  test('no scoring language; seismic row carries no inline style', () => {
    const html = buildCC(seisEnv, seisHistory('high', true, 'orange'), seisLoc);
    expect(html.toLowerCase()).not.toMatch(/seismic score|hazard score|out of 10/);
    expect(html).not.toMatch(/<div class="prem-climate-row"[^>]*style="/);
  });
});
