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

const COST_BREAKER_BUCKETS = ['geocoding', 'distancematrix', 'places_nearby', 'places_text', 'other'];

function parseCostBreaker(env, logger) {
  const enabled = String(env.COST_BREAKER_ENABLED ?? 'true').toLowerCase() !== 'false';
  const caps = {};
  for (const bucket of COST_BREAKER_BUCKETS) {
    const raw = env[`COST_BREAKER_CAP_${bucket.toUpperCase()}`];
    if (raw == null || String(raw).trim() === '') continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      logger.warn(`[config] WARN: COST_BREAKER_CAP_${bucket.toUpperCase()}="${raw}" is not a non-negative integer — using default.`);
      continue;
    }
    caps[bucket] = n;
  }
  return { enabled, caps };
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
    port: Number(env.PORT) || 3000,
    costBreaker: parseCostBreaker(env, logger),
  };
}

module.exports = { validateConfig, ConfigError, REQUIRED, OPTIONAL };
