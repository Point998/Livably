'use strict';
const { validateConfig, ConfigError } = require('../src/config');

function fakeLogger() {
  const warnings = [];
  return { warn: (m) => warnings.push(m), warnings };
}

describe('validateConfig', () => {
  test('throws ConfigError when GOOGLE_MAPS_API_KEY is missing', () => {
    expect(() => validateConfig({}, fakeLogger())).toThrow(ConfigError);
  });

  test('throws ConfigError when GOOGLE_MAPS_API_KEY is blank/whitespace', () => {
    expect(() => validateConfig({ GOOGLE_MAPS_API_KEY: '   ' }, fakeLogger())).toThrow(ConfigError);
  });

  test('warns once per missing optional key and returns config when required present', () => {
    const logger = fakeLogger();
    const cfg = validateConfig({ GOOGLE_MAPS_API_KEY: 'k' }, logger);
    expect(logger.warnings.length).toBe(6); // all 6 optional keys missing
    expect(cfg.googleMapsApiKey).toBe('k');
    expect(logger.warnings.some((w) => w.includes('NOAA_CDO_API_KEY'))).toBe(true);
  });

  test('port is a number (env.PORT coerced) and defaults to 3000', () => {
    expect(validateConfig({ GOOGLE_MAPS_API_KEY: 'k', PORT: '4000' }, fakeLogger()).port).toBe(4000);
    expect(validateConfig({ GOOGLE_MAPS_API_KEY: 'k' }, fakeLogger()).port).toBe(3000);
  });

  test('emits no warnings when all optional keys are set', () => {
    const logger = fakeLogger();
    validateConfig({
      GOOGLE_MAPS_API_KEY: 'k', NOAA_CDO_API_KEY: 'a', NREL_API_KEY: 'b',
      EIA_API_KEY: 'c', CENSUS_API_KEY: 'd', AIRNOW_API_KEY: 'e', OPENCHARGEMAP_API_KEY: 'f',
    }, logger);
    expect(logger.warnings.length).toBe(0);
  });

  test('adminToken is null when unset and the value when set', () => {
    expect(validateConfig({ GOOGLE_MAPS_API_KEY: 'k' }, fakeLogger()).adminToken).toBeNull();
    expect(validateConfig({ GOOGLE_MAPS_API_KEY: 'k', ADMIN_TOKEN: 't' }, fakeLogger()).adminToken).toBe('t');
  });
});
