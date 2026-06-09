'use strict';

const { ratesCache } = require('../cache');
const { RATE_FALLBACKS, TRIP_DISTANCE_DEFAULTS, RATES_GAS_TTL_DAYS, RATES_IRS_TTL_DAYS } = require('../utils/constants');

const DAY = 24 * 60 * 60 * 1000;

// EIA v2: US weekly regular gasoline retail price ($/gal).
const EIA_URL =
  'https://api.eia.gov/v2/petroleum/pri/gnd/data/?frequency=weekly' +
  '&data[0]=value&facets[product][]=EPMR&facets[duoarea][]=NUS' +
  '&sort[0][column]=period&sort[0][direction]=desc&length=1';

// Best-effort IRS standard mileage rate source (HTML page, parsed defensively).
const IRS_URL = 'https://www.irs.gov/tax-professionals/standard-mileage-rates';

async function fetchGasPrice() {
  const key = process.env.EIA_API_KEY;
  if (!key) return null;
  try {
    const resp = await fetch(`${EIA_URL}&api_key=${key}`, {
      signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const row = data?.response?.data?.[0];
    const value = Number(row?.value);
    if (!row || !value || value <= 0) return null;
    return { value, asOf: String(row.period || '') };
  } catch (err) {
    console.error('[EIA gas price]', err.message);
    return null;
  }
}

async function fetchIrsMileageRate() {
  try {
    const resp = await fetch(IRS_URL, {
      signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const m = html.match(/(\d{1,3})\s*cents per mile/i);
    if (!m) return null;
    const cents = parseInt(m[1], 10);
    if (!cents || cents <= 0 || cents > 200) return null;
    return { value: Math.round(cents) / 100, asOf: new Date().toISOString().slice(0, 10) };
  } catch (err) {
    console.error('[IRS mileage rate]', err.message);
    return null;
  }
}

// Read a cached {value, asOf, fetchedAt} if still within ttlDays; else null.
function cachedFresh(key, ttlDays) {
  const c = ratesCache.get(key);
  if (!c || !c.fetchedAt) return null;
  return (Date.now() - c.fetchedAt) < ttlDays * DAY ? c : null;
}

// Resolve one rate: fresh cache -> live fetch (cache on success) -> null.
async function resolveRate(key, ttlDays, fetcher) {
  const hit = cachedFresh(key, ttlDays);
  if (hit) return { value: hit.value, asOf: hit.asOf };
  const fetched = await fetcher();
  if (fetched && fetched.value > 0) {
    ratesCache.set(key, { value: fetched.value, asOf: fetched.asOf, fetchedAt: Date.now() });
    return { value: fetched.value, asOf: fetched.asOf };
  }
  return null;
}

// overrides.electricRatePerKwh: FR-032's per-address local rate, used for the
// EV-equivalent cost when available (>0); otherwise the national-avg fallback.
async function getDrivingRates(overrides = {}) {
  const gas = await resolveRate('rates:gas', RATES_GAS_TTL_DAYS, fetchGasPrice);
  const irs = await resolveRate('rates:irs', RATES_IRS_TTL_DAYS, fetchIrsMileageRate);

  const gasPricePerGallon = gas ? gas.value : RATE_FALLBACKS.gasPricePerGallon;
  const irsRatePerMile    = irs ? irs.value : RATE_FALLBACKS.irsRatePerMile;
  const { avgMpg, maintenancePerMile, evKwhPerMile } = RATE_FALLBACKS;

  const localElectric = Number(overrides.electricRatePerKwh);
  const hasLocalElectric = localElectric > 0;
  const electricRatePerKwh = hasLocalElectric ? localElectric : RATE_FALLBACKS.electricRatePerKwh;

  return {
    gasPricePerGallon,
    irsRatePerMile,
    avgMpg,
    maintenancePerMile,
    evKwhPerMile,
    electricRatePerKwh,
    marginalCostPerMile: gasPricePerGallon / avgMpg + maintenancePerMile,
    tripDistances: { ...TRIP_DISTANCE_DEFAULTS },
    sources: {
      gas: gas ? 'EIA' : 'fallback',
      irs: irs ? 'IRS' : 'fallback',
      electric: hasLocalElectric ? 'local' : 'national',
    },
    asOf: { gas: gas ? gas.asOf : null, irs: irs ? irs.asOf : null },
  };
}

module.exports = { fetchGasPrice, fetchIrsMileageRate, getDrivingRates };
