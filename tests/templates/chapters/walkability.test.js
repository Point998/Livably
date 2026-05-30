'use strict';
const { buildWalkabilityHTML } = require('../../../src/templates/chapters/walkability');

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
    const { buildWalkGlanceHTML } = require('../../../src/templates/chapters/walkability');
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
