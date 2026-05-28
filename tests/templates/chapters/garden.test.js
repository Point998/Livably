'use strict';
const { buildWhatWillGrowHTML } = require('../../../src/templates/chapters/garden');

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

  test('renders Level 3 expand toggle button', () => {
    const html = buildWhatWillGrowHTML(gardenData, soil, locationInfo);
    expect(html).toMatch(/garden-deep-toggle/);
    expect(html).toMatch(/Explore your yard/i);
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
