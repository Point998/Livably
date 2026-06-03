'use strict';
const { buildWhatWillGrowHTML } = require('../../../src/modules/garden/template');

const frost = { lastSpring: 'April 15', firstFall: 'October 15', days: 183 };
const hardinessZone = { zone: '6b', tempRange: '-5 to 0', frost };

const gardenData = {
  hardinessZone,
  nativePlants: [
    { name: 'Eastern Redbud', sci: 'Cercis canadensis', count: 40 },
    { name: 'Wild Bergamot', sci: 'Monarda fistulosa', count: 30 },
  ],
  invasivePlants: [
    { name: 'Amur Honeysuckle', sci: 'Lonicera maackii', count: 25 },
  ],
  wildlife: [{ name: 'White-tailed Deer', sci: 'Odocoileus virginianus', count: 50 }],
  birds: [{ name: 'Northern Cardinal', sci: 'Cardinalis cardinalis', count: 80 }],
  nativePlantsByForm: {
    trees: [{ name: 'Eastern Redbud', sci: 'Cercis canadensis', count: 40 }],
    shrubs: [],
    perennials: [{ name: 'Wild Bergamot', sci: 'Monarda fistulosa', count: 30 }],
    grasses: [],
    vines: [],
  },
  reptiles: [{ name: 'Eastern Box Turtle', sci: 'Terrapene carolina', count: 12 }],
  insects: [{ name: 'Monarch Butterfly', sci: 'Danaus plexippus', count: 20 }],
  butterflies: [
    { name: 'Eastern Tiger Swallowtail', sci: 'Papilio glaucus', count: 35 },
    { name: 'Cabbage White', sci: 'Pieris rapae', count: 12 },
  ],
  birdsBySeason: {
    yearRound: [{ name: 'Northern Cardinal', sci: 'Cardinalis cardinalis', count: 80 }],
    spring: [{ name: 'Yellow Warbler', sci: 'Setophaga petechia', count: 15 }],
    summer: [{ name: 'Ruby-throated Hummingbird', sci: 'Archilochus colubris', count: 10 }],
    fall: [{ name: 'Dark-eyed Junco', sci: 'Junco hyemalis', count: 25 }],
    winter: [{ name: 'White-throated Sparrow', sci: 'Zonotrichia albicollis', count: 20 }],
  },
  monarchCorridor: { inCorridor: true, milkweedSpecies: ['Common Milkweed (Asclepias syriaca)', 'Butterfly Weed (Asclepias tuberosa)'] },
  fireflyHabitat: true,
};

const soil = {
  muname: 'Maury silt loam',
  drainagecl: 'Well drained',
  drainageCategory: { label: 'Well drained', color: 'green', implication: 'Water drains readily.' },
};

const locationInfo = { state: 'KY', county: 'Scott County', zip: '40324' };

describe('buildWhatWillGrowHTML', () => {
  test('returns empty string for null gardenData', () => {
    expect(buildWhatWillGrowHTML(null, null, null)).toBe('');
  });

  test('renders Level 2 content (hardiness zone)', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).toMatch(/Zone 6b/);
    expect(html).toMatch(/April 15/);
    expect(html).toMatch(/183/);
  });

  test('no garden-deep-toggle button (replaced by depth system)', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).not.toMatch(/garden-deep-toggle/);
  });

  test('renders 8 tab buttons', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    const tabMatches = (html.match(/role="tab"/g) || []).length;
    expect(tabMatches).toBe(8);
  });

  test('renders Trees tab with tree species', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).toMatch(/gtab-trees/);
    expect(html).toMatch(/Eastern Redbud/);
  });

  test('renders Birds tab with seasonal sections', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).toMatch(/gtab-birds/);
    expect(html).toMatch(/Year.Round/i);
    expect(html).toMatch(/Northern Cardinal/);
  });

  test('renders monarch section when inCorridor is true', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).toMatch(/Monarch/i);
    expect(html).toMatch(/Asclepias syriaca/);
  });

  test('omits milkweed species when not in corridor', () => {
    const noMonarch = { ...gardenData, monarchCorridor: { inCorridor: false, milkweedSpecies: [] } };
    const html = buildWhatWillGrowHTML(noMonarch, soil, locationInfo);
    expect(html).not.toMatch(/Asclepias syriaca/);
  });

  test('renders firefly section for KY', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).toMatch(/[Ff]irefl/);
  });

  test('renders What to Remove tab with invasive species', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).toMatch(/gtab-remove/);
    expect(html).toMatch(/Amur Honeysuckle/);
  });

  test('renders Month by Month tab', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).toMatch(/gtab-calendar/);
    expect(html).toMatch(/JANUARY|January/);
    expect(html).toMatch(/JUNE|June/);
  });

  test('contains no scoring CSS classes (CONSTRAINT-001)', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).not.toMatch(/class="[^"]*\bscore\b/);
  });

  test('contains no direct inline styles (CONSTRAINT-008)', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    // CSS custom properties (style="--token:value") are allowed; direct style attributes are not
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('renders invasives empty-state text when no invasives', () => {
    const noInvasives = { ...gardenData, invasivePlants: [] };
    const html = buildWhatWillGrowHTML(noInvasives, soil, locationInfo);
    expect(html).toMatch(/No invasive plant observations/i);
  });

  test('renders birds fallback when no seasonal data', () => {
    const noSeasonal = {
      ...gardenData,
      birdsBySeason: { yearRound: [], spring: [], summer: [], fall: [], winter: [] },
    };
    const html = buildWhatWillGrowHTML(noSeasonal, soil, locationInfo);
    // Should still render without crash and show general birds
    expect(html).toMatch(/Northern Cardinal/);
  });
});

describe('buildWhatWillGrowHTML — FR-045 depth system', () => {
  const baseGarden = {
    hardinessZone: { zone: '6b', tempRange: '-5 to 0', frost: { lastSpring: 'April 15', firstFall: 'October 15', days: 183 } },
    nativePlants: [{ name: 'Red Maple', sci: 'Acer rubrum', count: 42 }],
    invasivePlants: [],
    wildlife: [],
    birds: [],
    nativePlantsByForm: { trees: [], shrubs: [], perennials: [], grasses: [], vines: [] },
    reptiles: [], insects: [], butterflies: [],
    birdsBySeason: { yearRound: [], spring: [], summer: [], fall: [], winter: [] },
    monarchCorridor: { inCorridor: false, milkweedSpecies: [] },
    fireflyHabitat: false,
  };
  const locationInfo = { state: 'KY', county: 'Scott County', zip: '40324' };

  test('renders depth-l1 glance bar', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance bar shows zone', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    expect(html).toMatch(/6b/);
  });

  test('glance bar shows growing season days', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    expect(html).toMatch(/183/);
  });

  test('no garden-deep-toggle button (replaced by depth selector)', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    expect(html).not.toMatch(/garden-deep-toggle/);
  });

  test('deep dive content wrapped in depth-l3', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    expect(html).toMatch(/depth-l3/);
  });

  test('depth selector rendered (chapter-depth-control)', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    expect(html).toMatch(/chapter-depth-control/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildWhatWillGrowHTML(baseGarden, null, locationInfo);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

const microclimateLat38 = { lat: 38, elevationFt: 855, solarSummerDeg: 76, solarWinterDeg: 29 };
const microclimateLat46 = { lat: 46, elevationFt: 4820, solarSummerDeg: 68, solarWinterDeg: 21 };

describe('buildWhatWillGrowHTML — microclimate subsection', () => {
  test('renders microclimate section when present', () => {
    const gd = { ...gardenData, microclimate: microclimateLat38 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).toMatch(/Your Microclimate/);
  });

  test('shows solar angles in narrative', () => {
    const gd = { ...gardenData, microclimate: microclimateLat38 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).toMatch(/76°/);
    expect(html).toMatch(/29°/);
  });

  test('shows elevation rounded to nearest 10 feet', () => {
    // 855 → Math.round(855/10)*10 = 860; verifies the rounding path is exercised
    const gd = { ...gardenData, microclimate: microclimateLat38 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).toMatch(/860 feet/);
    expect(html).not.toMatch(/855 feet/);
  });

  test('omits elevation text when elevationFt is null', () => {
    const gd = { ...gardenData, microclimate: { lat: 38, elevationFt: null, solarSummerDeg: 76, solarWinterDeg: 29 } };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).toMatch(/Your Microclimate/);
    expect(html).not.toMatch(/feet in elevation/);
  });

  test('microclimate absent when microclimate is null', () => {
    const gd = { ...gardenData, microclimate: null };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).not.toMatch(/Your Microclimate/);
  });

  test('shadow length shown for lat 38 (11-foot)', () => {
    const gd = { ...gardenData, microclimate: microclimateLat38 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).toMatch(/11-foot/);
  });

  test('shadow length shown for lat 46 (16-foot)', () => {
    const gd = { ...gardenData, microclimate: microclimateLat46 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    expect(html).toMatch(/16-foot/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const gd = { ...gardenData, microclimate: microclimateLat38 };
    const html = buildWhatWillGrowHTML(gd, soil, locationInfo);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('microclimate absent when gardenData has no microclimate key', () => {
    // existing gardenData fixture has no microclimate key
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).not.toMatch(/Your Microclimate/);
  });
});
