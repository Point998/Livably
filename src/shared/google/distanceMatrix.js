'use strict';
const { driveTimeCache, driveTimeCellCache } = require('../../cache');
const { googleMapsClient, googleMapsApiKey } = require('./client');
const { getNextTuesday8am, getNextDayAt } = require('../../utils/time');
const { TRAFFIC_VARIATION_SLOTS } = require('../../utils/constants');

// FR-058: when a `cellId` is supplied (options.cellId), the result is keyed by
// cell and stored in the long-TTL cell cache, so every address in the cell
// shares one fetch. Callers pass the cell centroid as `originLatLng` in that
// case. Without a cellId, behavior is unchanged: per-address key, 24h cache.
async function getDriveTime(originLatLng, destinationLatLng, options = {}) {
  const destStr = `${destinationLatLng.lat},${destinationLatLng.lng}`;
  const { cellId } = options;
  const useCell = Boolean(cellId);
  const cache = useCell ? driveTimeCellCache : driveTimeCache;
  const cacheKey = useCell ? `${cellId}:${destStr}` : `${originLatLng}:${destStr}`;

  const cached = cache.get(cacheKey);
  if (cached !== null) { console.log('[CACHE HIT] drivetime:', cacheKey); return cached; }

  const distanceResponse = await googleMapsClient.distancematrix({
    params: {
      key: googleMapsApiKey,
      origins: [originLatLng],
      destinations: [destStr],
      mode: 'driving',
      departure_time: getNextTuesday8am(),
    },
  });

  const element = distanceResponse.data.rows[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error('Unable to calculate drive time for the destination.');
  }

  const minutes = Math.round((element.duration_in_traffic?.value ?? element.duration?.value) / 60);
  cache.set(cacheKey, minutes);
  return minutes;
}

// FR-058 safety tier (CONSTRAINT-003): the drive time a buyer reads for the
// selected hospital / urgent care is recomputed from the ACTUAL address — never
// banded, never cell-shared. Per-address key in the 24h cache (not the long-TTL
// cell cache). This is the ~1–2 Distance Matrix calls/report we accept to keep
// the safety number genuinely exact for each house.
async function getExactDriveTime(actualOrigin, destinationLatLng) {
  return getDriveTime(actualOrigin, destinationLatLng);
}

async function getTrafficVariations(originLatLng, destLocation, options = {}) {
  const destLatLng = `${destLocation.lat},${destLocation.lng}`;
  const { cellId } = options;
  const useCell = Boolean(cellId);
  const cache = useCell ? driveTimeCellCache : driveTimeCache;
  const keyOrigin = useCell ? cellId : originLatLng;

  const slots = TRAFFIC_VARIATION_SLOTS.map(({ label, display, targetDay, hour }) => ({
    label, display, ts: getNextDayAt(targetDay, hour),
  }));

  const results = await Promise.allSettled(
    slots.map(async ({ label, display, ts }) => {
      const cacheKey = `traffic:${keyOrigin}:${destLatLng}:${label}`;
      const cached = cache.get(cacheKey);
      if (cached !== null) { console.log('[CACHE HIT] traffic slot:', cacheKey); return cached; }

      const resp = await googleMapsClient.distancematrix({
        params: {
          key: googleMapsApiKey,
          origins: [originLatLng],
          destinations: [destLatLng],
          mode: 'driving',
          departure_time: ts,
        },
      });
      const el = resp.data.rows[0]?.elements?.[0];
      if (!el || el.status !== 'OK') throw new Error('no element');
      const result = {
        label,
        display,
        minutes: Math.round((el.duration_in_traffic?.value ?? el.duration?.value) / 60),
      };
      cache.set(cacheKey, result);
      return result;
    }),
  );

  const variations = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!variations.length) return null;

  const allMinutes = variations.map((v) => v.minutes);
  const min = Math.min(...allMinutes);
  const max = Math.max(...allMinutes);
  const avg = Math.round(allMinutes.reduce((a, b) => a + b, 0) / allMinutes.length);

  return { variations, stats: { min, max, avg, range: max - min } };
}

module.exports = { getDriveTime, getExactDriveTime, getTrafficVariations };
