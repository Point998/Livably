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

const fullDemographics = {
  ...baseDemographics,
  incomeDistribution: {
    totalHouseholds: 1000,
    hasSuppressed: false,
    brackets: [
      { label: 'Under $25k',  pct: 18, count: 180 },
      { label: '$25k–$50k',   pct: 22, count: 220 },
      { label: '$50k–$75k',   pct: 20, count: 200 },
      { label: '$75k–$100k',  pct: 15, count: 150 },
      { label: '$100k+',      pct: 25, count: 250 },
    ],
  },
  educationLadder: {
    totalAdults: 3000,
    steps: [
      { label: 'Less than high school',      pct: 10 },
      { label: 'High school / GED',          pct: 28 },
      { label: "Some college / Associate's", pct: 22 },
      { label: "Bachelor's degree",          pct: 25 },
      { label: 'Graduate degree',            pct: 15 },
    ],
  },
  householdComposition: {
    totalHouseholds: 1000,
    familyPct: 65,
    marriedCouplePct: 45,
    singleParentPct: 20,
    nonfamilyPct: 35,
    livingAlonePct: 22,
  },
  commuteMode: {
    totalWorkers: 2000,
    droveAlonePct: 72,
    carpoolPct: 10,
    transitPct: 4,
    bicyclePct: 1,
    walkedPct: 3,
    otherPct: 2,
    wfhPct: 8,
  },
  tractFips: {
    state: '21',
    county: '077',
    tract: '010101',
    censusExplorerUrl: 'https://data.census.gov/table?g=1400000US21077010101',
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

describe('buildDemographicsHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present when incomeDistribution present', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/depth-l3/);
  });

  test('community-deep-dive container rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/community-deep-dive/);
  });

  test('Income Distribution tab rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/Income Distribution/);
  });

  test('Education Ladder tab rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/Education Ladder/);
  });

  test('Household Types tab rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/Household Types/);
  });

  test('How People Get to Work tab rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/How People Get to Work/);
  });

  test('income bracket labels appear in output', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/Under \$25k/);
    expect(html).toMatch(/\$100k\+/);
  });

  test('education step labels appear in output', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/Less than high school/);
    expect(html).toMatch(/Graduate degree/);
  });

  test('household composition stats appear', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/65%/);
  });

  test('commute mode stats appear', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/72%/);
  });

  test('suppressed note shown when hasSuppressed is true', () => {
    const d = { ...fullDemographics, incomeDistribution: { ...fullDemographics.incomeDistribution, hasSuppressed: true } };
    const html = buildDemographicsHTML(d);
    expect(html).toMatch(/suppressed/i);
  });

  test('L3 absent when all deep-dive fields are null', () => {
    const d = { ...baseDemographics, incomeDistribution: null, educationLadder: null, householdComposition: null, commuteMode: null, tractFips: null };
    const html = buildDemographicsHTML(d);
    expect(html).not.toMatch(/community-deep-dive/);
  });

  test('missing commuteMode does not render commute tab', () => {
    const d = { ...fullDemographics, commuteMode: null };
    const html = buildDemographicsHTML(d);
    expect(html).not.toMatch(/How People Get to Work/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildDemographicsHTML(fullDemographics);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildDemographicsHTML — L4 research', () => {
  test('depth-l4 wrapper present when incomeDistribution present', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/depth-l4/);
  });

  test('income raw count table rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/climate-research-section/);
    expect(html).toMatch(/climate-data-table/);
  });

  test('census explorer link rendered', () => {
    const html = buildDemographicsHTML(fullDemographics);
    expect(html).toMatch(/data\.census\.gov/);
  });

  test('L4 absent when no deep-dive data', () => {
    const d = { ...baseDemographics, incomeDistribution: null, educationLadder: null, tractFips: null };
    const html = buildDemographicsHTML(d);
    expect(html).not.toMatch(/depth-l4/);
  });
});
