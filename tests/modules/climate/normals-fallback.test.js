'use strict';

// FR-065 — Open-Meteo ERA5 modeled-normals fallback for climate normals.
// Tests the pure aggregation transform (daily series -> NOAA normals contract).
// Critical guard: Open-Meteo returns °F / inch already — NO tenths/hundredths
// division (that conversion belongs only to the NOAA CDO path).

jest.mock('../../../src/logger', () => ({
  logError: jest.fn(), logRequest: jest.fn(), logAnalysis: jest.fn(), readRecentLogs: jest.fn(() => []),
}));

const { aggregateOpenMeteoNormals, getNormalsFromModel, getClimateNormals } = require('../../../src/modules/climate/data');

const okJson = (body) => ({ ok: true, json: async () => body });
const sampleDaily = {
  daily: {
    time: ['2020-01-01', '2020-01-02', '2020-07-15'],
    temperature_2m_max: [40, 50, 92],
    temperature_2m_min: [30, 20, 71],
    precipitation_sum: [0.1, 0.3, 0],
    snowfall_sum: [0, 1, 0],
  },
};

describe('aggregateOpenMeteoNormals', () => {
  test('averages daily max/min across years within a calendar month', () => {
    const daily = {
      time:                ['2019-01-01', '2019-01-02', '2020-01-01', '2020-01-02'],
      temperature_2m_max:  [40, 50, 60, 50],
      temperature_2m_min:  [30, 20, 40, 10],
      precipitation_sum:   [0.1, 0.3, 0.5, 0.1],
      snowfall_sum:        [0, 1, 2, 0],
    };
    const jan = aggregateOpenMeteoNormals(daily).monthly[0];
    expect(jan.month).toBe(1);
    expect(jan.tMaxF).toBe(50);   // mean(40,50,60,50)
    expect(jan.tMinF).toBe(25);   // mean(30,20,40,10)
  });

  test('precip and snow are the mean MONTHLY TOTAL across years (sum per year, then average)', () => {
    const daily = {
      time:                ['2019-01-01', '2019-01-02', '2020-01-01', '2020-01-02'],
      temperature_2m_max:  [40, 50, 60, 50],
      temperature_2m_min:  [30, 20, 40, 10],
      precipitation_sum:   [0.1, 0.3, 0.5, 0.1],   // 2019 total 0.4, 2020 total 0.6
      snowfall_sum:        [0, 1, 2, 0],           // 2019 total 1.0, 2020 total 2.0
    };
    const jan = aggregateOpenMeteoNormals(daily).monthly[0];
    expect(jan.precipIn).toBeCloseTo(0.5, 5); // mean(0.4, 0.6)
    expect(jan.snowIn).toBeCloseTo(1.5, 5);   // mean(1.0, 2.0)
  });

  test('does NOT divide temperatures (Open-Meteo is already °F, unlike NOAA tenths)', () => {
    const daily = {
      time: ['2020-07-15'], temperature_2m_max: [92], temperature_2m_min: [71],
      precipitation_sum: [0], snowfall_sum: [0],
    };
    const jul = aggregateOpenMeteoNormals(daily).monthly[6];
    expect(jul.tMaxF).toBe(92); // not 9.2
    expect(jul.tMinF).toBe(71); // not 7.1
  });

  test('annual day-counts are per-year means derived from the daily series', () => {
    const daily = {
      time:                ['2020-07-01', '2020-07-02', '2020-07-03', '2020-01-10', '2020-01-11'],
      temperature_2m_max:  [95, 90, 89, 20, 25],
      temperature_2m_min:  [70, 68, 66, 32, 31],
      precipitation_sum:   [0, 0, 0, 0, 0],
      snowfall_sum:        [0, 0, 0, 1, 2],
    };
    const { annual } = aggregateOpenMeteoNormals(daily); // 1 year of data
    expect(annual.daysAbove90).toBe(2); // tmax >= 90: 95, 90
    expect(annual.daysAbove95).toBe(1); // tmax >= 95: 95
    expect(annual.daysBelow32).toBe(2); // tmin <= 32: 32, 31
  });

  test('returns all 12 months; months with no data have null fields', () => {
    const daily = {
      time: ['2020-03-01'], temperature_2m_max: [60], temperature_2m_min: [40],
      precipitation_sum: [0.2], snowfall_sum: [0],
    };
    const { monthly } = aggregateOpenMeteoNormals(daily);
    expect(monthly).toHaveLength(12);
    expect(monthly[2].tMaxF).toBe(60);   // March populated
    expect(monthly[0].tMaxF).toBeNull(); // January empty
  });

  test('carries the regional/modeled provenance label and null stationId', () => {
    const daily = { time: ['2020-03-01'], temperature_2m_max: [60], temperature_2m_min: [40], precipitation_sum: [0.2], snowfall_sum: [0] };
    const out = aggregateOpenMeteoNormals(daily);
    expect(out.stationId).toBeNull();
    expect(out.stationName).toMatch(/Open-Meteo/);
  });

  test('ignores null daily entries (Open-Meteo gaps) without poisoning the average', () => {
    const daily = {
      time: ['2020-01-01', '2020-01-02'], temperature_2m_max: [50, null],
      temperature_2m_min: [null, 30], precipitation_sum: [0.2, null], snowfall_sum: [null, 1],
    };
    const jan = aggregateOpenMeteoNormals(daily).monthly[0];
    expect(jan.tMaxF).toBe(50); // null skipped
    expect(jan.tMinF).toBe(30);
  });
});

describe('getNormalsFromModel', () => {
  afterEach(() => jest.restoreAllMocks());

  test('returns aggregated normals on a successful Open-Meteo response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(okJson(sampleDaily));
    const out = await getNormalsFromModel(38.2, -84.5);
    expect(out.monthly).toHaveLength(12);
    expect(out.monthly[0].tMaxF).toBe(45); // Jan mean(40,50)
    expect(out.stationName).toMatch(/Open-Meteo/);
  });

  test('returns null on a non-ok response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await getNormalsFromModel(38.2, -84.5)).toBeNull();
  });

  test('returns null on an empty daily series', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(okJson({ daily: { time: [] } }));
    expect(await getNormalsFromModel(38.2, -84.5)).toBeNull();
  });
});

describe('getClimateNormals (chain: NOAA → model → null)', () => {
  let savedKey;
  beforeEach(() => {
    savedKey = process.env.NOAA_CDO_API_KEY; delete process.env.NOAA_CDO_API_KEY;
    jest.spyOn(console, 'warn').mockImplementation(() => {}); // chain logs NOAA-miss; not under test here
  });
  afterEach(() => { if (savedKey !== undefined) process.env.NOAA_CDO_API_KEY = savedKey; jest.restoreAllMocks(); });

  test('falls back to the model and tags normalsSource when NOAA has no key/data', async () => {
    // No NOAA key → getNOAAClimateNormals returns null → chain tries the model.
    jest.spyOn(global, 'fetch').mockResolvedValue(okJson(sampleDaily));
    const out = await getClimateNormals(38.2, -84.5);
    expect(out.normalsSource).toBe('model');
    expect(out.monthly[0].tMaxF).toBe(45);
  });

  test('returns null when both NOAA and the model fail (→ link floor)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await getClimateNormals(38.2, -84.5)).toBeNull();
  });
});
