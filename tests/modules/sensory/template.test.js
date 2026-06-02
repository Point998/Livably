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

describe('buildSensoryEnvironmentalHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/depth-l3/);
  });

  test('sensory-deep-dive container rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/sensory-deep-dive/);
  });

  test('EPA Research Tools tab rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/EPA Research Tools/);
  });

  test('AirNow link rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/airnow\.gov/);
  });

  test('EJSCREEN link rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/ejscreen\.epa\.gov/);
  });

  test('EWG Tap Water link rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/ewg\.org\/tapwater/);
  });

  test('radon zone shown in research tools when available', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/Zone 2/);
  });

  test('Environmental Inspection tab rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/Environmental Inspection/);
  });

  test('radon test item present in inspection checklist', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/radon test/i);
  });

  test('urgent radon framing when zone 1', () => {
    const env = { ...baseEnv, radon: { zone: 1 } };
    const html = buildSensoryEnvironmentalHTML(env);
    expect(html).toMatch(/Zone 1/);
  });

  test('bortle scale still present (fullHTML append not replace)', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/prem-bortle-scale/);
    expect(html).toMatch(/depth-l3/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildSensoryEnvironmentalHTML — L4 research', () => {
  test('depth-l4 wrapper present', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/depth-l4/);
  });

  test('environmental data table rendered', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/climate-data-table/);
  });

  test('AQI value in table', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/42/);
  });

  test('road noise dB in table', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/52 dB/);
  });

  test('radon zone in table', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/Zone 2/);
  });

  test('water system name in table', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/Georgetown Water Works/);
  });

  test('bortle scale still present alongside L4', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    expect(html).toMatch(/prem-bortle-scale/);
    expect(html).toMatch(/depth-l4/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSensoryEnvironmentalHTML(baseEnv);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
