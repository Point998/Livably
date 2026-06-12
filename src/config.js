'use strict';

const REQUIRED = ['GOOGLE_MAPS_API_KEY'];

const OPTIONAL = {
  NOAA_CDO_API_KEY: 'Climate — 30-year normals',
  NREL_API_KEY: 'Utilities — electric rate + EV charging',
  EIA_API_KEY: 'Costs — live gas price',
  CENSUS_API_KEY: 'Community/Growth — ACS demographics',
  AIRNOW_API_KEY: 'Sensory — air quality',
  OPENCHARGEMAP_API_KEY: 'Utilities — EV charging fallback',
};

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

function isBlank(v) {
  return v == null || String(v).trim() === '';
}

function validateConfig(env = process.env, logger = console) {
  const missing = REQUIRED.filter((k) => isBlank(env[k]));
  if (missing.length) {
    throw new ConfigError(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Set them in .env (see .env.example) before starting the server.`,
    );
  }
  for (const [key, chapter] of Object.entries(OPTIONAL)) {
    if (isBlank(env[key])) {
      logger.warn(`[config] WARN: ${key} not set — ${chapter} will run degraded (graceful fallback).`);
    }
  }
  return {
    googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
    adminToken: isBlank(env.ADMIN_TOKEN) ? null : env.ADMIN_TOKEN,
    port: env.PORT || 3000,
  };
}

module.exports = { validateConfig, ConfigError, REQUIRED, OPTIONAL };
