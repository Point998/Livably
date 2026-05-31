'use strict';
const { buildSensoryEnvironmentalHTML } = require('../../../src/modules/sensory/template');

const baseEnv = {
  airports: [{ name: 'Cincinnati/Northern Kentucky International', distanceMiles: 22.5 }],
  roadNoise: { dnl: 52, source: 'BTS', nearestRoad: { name: 'US-25' } },
  rail: null,
  lightPollution: { bortle: 4, label: 'Rural/Suburban Transition', desc: 'Milky Way visible on clear nights.' },
  airQuality: {
    aqi: 42,
    category: { label: 'Good', color: 'green', description: 'Air quality is satisfactory.' },
    primaryPollutant: 'PM2.5',
  },
  waterQuality: { systemName: 'Georgetown Water Works', violations: [] },
  radon: { zone: 2 },
  ejscreen: { flagged: false },
};

describe('buildSensoryEnvironmentalHTML — FR-045 glance bar', () => {
  test('renders chapter-glance in depth-l1', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance shows AQI label with badge', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/AQI:/);
    expect(html).toMatch(/badge-green/);
    expect(html).toMatch(/Good/);
  });

  test('glance shows radon zone', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/Radon Zone 2/);
  });

  test('glance shows nearest airport distance', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/Nearest airport: 23 mi/);
  });

  test('glance omitted when no air quality, radon, or airports', () => {
    const env = { ...baseEnv, airQuality: null, radon: null, airports: [] };
    const html = buildSensoryEnvironmentalHTML(env);
    expect(html).not.toMatch(/chapter-glance/);
  });

  test('returns empty string when env is null', () => {
    const html = buildSensoryEnvironmentalHTML(null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
