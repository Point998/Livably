'use strict';
const { driveTimeCache } = require('../../cache');
const { googleMapsClient, googleMapsApiKey } = require('./client');
const { getNextTuesday8am, getNextDayAt } = require('../../utils/time');
const { TRAFFIC_VARIATION_SLOTS } = require('../../utils/constants');

async function getDriveTime(originLatLng, destinationLatLng) {
  const destStr = `${destinationLatLng.lat},${destinationLatLng.lng}`;
  const cacheKey = `${originLatLng}:${destStr}`;
  const cached = driveTimeCache.get(cacheKey);
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
  driveTimeCache.set(cacheKey, minutes);
  return minutes;
}

async function getTrafficVariations(originLatLng, destLocation) {
  const destLatLng = `${destLocation.lat},${destLocation.lng}`;
  const slots = TRAFFIC_VARIATION_SLOTS.map(({ label, display, targetDay, hour }) => ({
    label, display, ts: getNextDayAt(targetDay, hour),
  }));

  const results = await Promise.allSettled(
    slots.map(async ({ label, display, ts }) => {
      const cacheKey = `traffic:${originLatLng}:${destLatLng}:${label}`;
      const cached = driveTimeCache.get(cacheKey);
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
      driveTimeCache.set(cacheKey, result);
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

module.exports = { getDriveTime, getTrafficVariations };
