'use strict';
const { buildWalkabilityHTML } = require('../../../src/modules/walkability/template');

const baseWalk = {
  score: 62,
  category: {
    label: 'Somewhat Walkable',
    color: 'gold',
    description: 'Some errands can be accomplished on foot.',
  },
  destinations: [
    { name: 'Kroger', label: 'Grocery Store', icon: '🛒', walkMinutes: 14, distanceMiles: 0.7 },
    { name: 'Starbucks', label: 'Coffee', icon: '☕', walkMinutes: 8, distanceMiles: 0.4 },
  ],
};

describe('buildWalkabilityHTML — FR-045 glance bar', () => {
  test('renders chapter-glance in depth-l1', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance shows walkability category badge', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/badge-gold/);
    expect(html).toMatch(/Somewhat Walkable/);
  });

  test('glance shows category description', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/Some errands can be accomplished on foot/);
  });

  test('returns empty string when walk is null', () => {
    const html = buildWalkabilityHTML(null);
    expect(html).toBe('');
  });

  test('glance bar absent when category is missing', () => {
    // buildWalkGlanceHTML guards on walk?.category; the chapter card renders without a glance
    // But buildWalkabilityHTML itself requires category - test the glance function directly
    const { buildWalkGlanceHTML } = require('../../../src/modules/walkability/template');
    const html = buildWalkGlanceHTML({ score: 50, destinations: [] });
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildWalkabilityHTML(baseWalk);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('CONSTRAINT-001: numeric score not rendered', () => {
    const html = buildWalkabilityHTML(baseWalk);
    // The raw number 62 must not appear as a displayed score
    expect(html).not.toMatch(/walk-display-num/);
    expect(html).not.toMatch(/walkability index \(0/i);
    // Category label is still present
    expect(html).toMatch(/Somewhat Walkable/);
  });

  test('CONSTRAINT-001: score not rendered even at high value', () => {
    const highWalk = { ...baseWalk, score: 95, category: { label: "Walker's Paradise", color: 'green', description: 'Daily errands do not require a car.' } };
    const html = buildWalkabilityHTML(highWalk);
    expect(html).not.toMatch(/walk-display-num/);
    expect(html).not.toMatch(/>95</);
  });
});

describe('buildWalkabilityHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/depth-l3/);
  });

  test('walk-deep-dive container rendered', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/walk-deep-dive/);
  });

  test('Walk Before Closing tab rendered', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/Walk Before Closing/);
  });

  test('Street View mentioned in Walk Before Closing tab', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/Street View/);
  });

  test('Research Tools tab rendered', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/Research Tools/);
  });

  test('Walk Score link present', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/walkscore\.com/);
  });

  test('Google Maps link present', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/maps\.google\.com/);
  });

  test('L3 present for low-walkability address', () => {
    const lowWalk = { ...baseWalk, score: 10, category: { label: 'Very Car-Dependent', color: 'red', description: 'Almost all errands require a car.' } };
    const html = buildWalkabilityHTML(lowWalk);
    expect(html).toMatch(/depth-l3/);
  });

  test('verdict block still present (fullHTML append not replace)', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/walk-verdict-block/);
    expect(html).toMatch(/depth-l3/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildWalkabilityHTML(baseWalk);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildWalkabilityHTML — L4 research', () => {
  test('depth-l4 wrapper present when destinations exist', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/depth-l4/);
  });

  test('destinations table rendered', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/climate-data-table/);
  });

  test('destination name appears in table', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/Kroger/);
    expect(html).toMatch(/Starbucks/);
  });

  test('walk time appears in table', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/14 min/);
    expect(html).toMatch(/8 min/);
  });

  test('distance displayed in table', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/0\.7 mi/);
  });

  test('verdict block still present alongside L4', () => {
    const html = buildWalkabilityHTML(baseWalk);
    expect(html).toMatch(/walk-verdict-block/);
    expect(html).toMatch(/depth-l4/);
  });

  test('L4 absent when no destinations', () => {
    const noDestWalk = { ...baseWalk, destinations: [] };
    const html = buildWalkabilityHTML(noDestWalk);
    expect(html).not.toMatch(/depth-l4/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildWalkabilityHTML(baseWalk);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
