const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('@googlemaps/google-maps-services-js');
const { geocodeCache, placesCache, driveTimeCache, cacheStats } = require('./cache');
const { makeGoogleMapsRequest, QuotaExceededError, RateLimitError, getUsageStats } = require('./rateLimit');
const { getPremiumData, buildPremiumSectionsHTML } = require('./premium');
const { logRequest, logError, logAnalysis, readRecentLogs } = require('./logger');
const { getMitigation, loadMitigations } = require('./errorMemory');

const app = express();
const port = process.env.PORT || 3000;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
// Proxy-wrap the Maps client so every method call goes through the rate limiter + retry logic.
const _rawMapsClient = new Client({});
const googleMapsClient = new Proxy(_rawMapsClient, {
  get(target, prop) {
    const val = Reflect.get(target, prop);
    if (typeof val === 'function') {
      return (...args) => makeGoogleMapsRequest(() => Reflect.apply(val, target, args), prop);
    }
    return val;
  },
});

const DATA_DIR = path.join(__dirname, '../data');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

function ensureReportsFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_FILE)) fs.writeFileSync(REPORTS_FILE, '{}', 'utf8');
}

function loadReports() {
  try {
    return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveReport(address) {
  ensureReportsFile();
  const reports = loadReports();
  let id;
  do { id = crypto.randomBytes(4).toString('hex'); } while (reports[id]);
  const now = new Date().toISOString();
  reports[id] = { address, createdAt: now, lastAccessed: now };
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
  return id;
}

function getReport(reportId) {
  return loadReports()[reportId] || null;
}

function updateReportAccess(reportId) {
  ensureReportsFile();
  const reports = loadReports();
  if (reports[reportId]) {
    reports[reportId].lastAccessed = new Date().toISOString();
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
  }
}

app.use(express.static(path.join(__dirname, '../public')));

function getNextTuesday8am() {
  const now = new Date();
  const nextTuesday = new Date(now);
  const currentDay = nextTuesday.getDay();
  let daysUntilTuesday = (2 - currentDay + 7) % 7;

  if (daysUntilTuesday === 0) {
    const todayAt8 = new Date(nextTuesday);
    todayAt8.setHours(8, 0, 0, 0);
    if (nextTuesday >= todayAt8) {
      daysUntilTuesday = 7;
    }
  }

  nextTuesday.setDate(nextTuesday.getDate() + daysUntilTuesday);
  nextTuesday.setHours(8, 0, 0, 0);
  nextTuesday.setMinutes(0);
  nextTuesday.setSeconds(0);
  nextTuesday.setMilliseconds(0);
  return Math.floor(nextTuesday.getTime() / 1000);
}

// Returns a Unix timestamp (seconds) for the next occurrence of targetDay at the given hour.
// targetDay: 0=Sun … 6=Sat.  Always returns a future time (at least 30 min ahead).
function getNextDayAt(targetDay, hour) {
  const now = new Date();
  const candidate = new Date(now);
  let days = (targetDay - now.getDay() + 7) % 7;
  if (days === 0) {
    const todayAtHour = new Date(now);
    todayAtHour.setHours(hour, 0, 0, 0);
    if (now >= todayAtHour) days = 7;
  }
  candidate.setDate(candidate.getDate() + days);
  candidate.setHours(hour, 0, 0, 0);
  return Math.floor(candidate.getTime() / 1000);
}

async function getTrafficVariations(originLatLng, destLocation) {
  const destLatLng = `${destLocation.lat},${destLocation.lng}`;
  const slots = [
    { label: 'morningRush', display: '8am Mon',  ts: getNextDayAt(1, 8)  },
    { label: 'midday',      display: '12pm Mon', ts: getNextDayAt(1, 12) },
    { label: 'eveningRush', display: '5pm Mon',  ts: getNextDayAt(1, 17) },
    { label: 'weekend',     display: '10am Sat', ts: getNextDayAt(6, 10) },
  ];

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

async function geocodeAddress(address) {
  const cacheKey = address.toLowerCase().trim();
  const cached = geocodeCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] geocode:', cacheKey); return cached; }

  const geocodeResponse = await googleMapsClient.geocode({
    params: { address, key: googleMapsApiKey },
  });

  const geoResults = geocodeResponse.data.results || [];
  if (!geoResults.length) {
    throw new Error('Unable to geocode the address.');
  }

  const location = geoResults[0].geometry.location;
  geocodeCache.set(cacheKey, location);
  return location;
}

function isExcludedPlaceName(name, excludeTerms) {
  const normalized = (name || '').toLowerCase();
  return excludeTerms.some((term) => normalized.includes(term));
}

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

// Returns top 3 nearest grocery stores by drive time.
// Uses textSearch with tight radius so Google relevance is overridden by actual drive time.
// Excludes gas stations, convenience stores, and dollar stores by place type.
async function findNearestGrocery(originLatLng) {
  const cacheKey = `grocery:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'grocery store',
      location: originLatLng,
      radius: getMitigation('findNearestGrocery', 'searchRadiusM', 8000),
    },
  });

  const placeResults = (placesResponse.data.results || []).filter((place) => {
    const types = place.types || [];
    return !types.includes('gas_station') &&
           !types.includes('convenience_store') &&
           !types.includes('lodging');
  });

  if (!placeResults.length) {
    throw new Error('No grocery stores found near that address.');
  }

  // Calculate drive times for top 8 candidates, return 3 fastest
  const candidates = placeResults.slice(0, 8);
  const withDriveTimes = await Promise.all(
    candidates.map(async (place) => {
      try {
        const driveTimeMinutes = await getDriveTime(originLatLng, place.geometry.location);
        return {
          name: place.name,
          address: place.formatted_address || place.vicinity || place.name,
          location: place.geometry.location,
          driveTimeMinutes,
        };
      } catch (e) {
        logError('findNearestGrocery', originLatLng, e);
        return null;
      }
    }),
  );

  const valid = withDriveTimes.filter(Boolean);
  valid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);
  const result = valid.slice(0, 3);
  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestPharmacy(originLatLng) {
  const cacheKey = `pharmacy:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'pharmacy',
    },
  });

  const place = (placesResponse.data.results || [])[0];
  if (!place) {
    throw new Error('No pharmacy found near that address.');
  }

  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

// Gets top 5 hospital results, calculates actual drive time to each,
// and returns the one with the shortest drive time — not just Google's first result.
async function findNearestHospital(originLatLng) {
  const cacheKey = `hospital:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  let placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'hospital emergency department',
      location: originLatLng,
      radius: 50000,
    },
  });

  let placeResults = placesResponse.data.results || [];

  if (!placeResults.length) {
    placesResponse = await googleMapsClient.placesNearby({
      params: {
        key: googleMapsApiKey,
        location: originLatLng,
        rankby: 'distance',
        type: 'hospital',
      },
    });
    placeResults = placesResponse.data.results || [];
  }

  if (!placeResults.length) {
    throw new Error('No hospital found near that address.');
  }

  const candidates = placeResults.slice(0, 5);
  const withDriveTimes = await Promise.all(
    candidates.map(async (place) => {
      try {
        const driveTimeMinutes = await getDriveTime(originLatLng, place.geometry.location);
        return {
          name: place.name,
          address: place.formatted_address || place.vicinity || place.name,
          location: place.geometry.location,
          driveTimeMinutes,
        };
      } catch (e) {
        logError('findNearestHospital', originLatLng, e);
        return null;
      }
    }),
  );

  const valid = withDriveTimes.filter(Boolean);
  if (!valid.length) {
    throw new Error('Unable to calculate drive times to nearby hospitals.');
  }

  valid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);
  const result = valid[0];
  placesCache.set(cacheKey, result);
  return result;
}

// Returns true for places that are primarily a pharmacy, drug store, or retail store —
// indicating an in-store health clinic rather than a standalone urgent care facility.
function isRetailEmbeddedHealth(place) {
  const types = place.types || [];
  return types.includes('pharmacy') ||
         types.includes('drug_store') ||
         types.includes('store') ||
         types.includes('supermarket') ||
         types.includes('grocery_or_supermarket');
}

async function findNearestUrgentCare(originLatLng) {
  const cacheKey = `urgentcare:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  let placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      keyword: 'urgent care',
    },
  });

  let placeResults = (placesResponse.data.results || []).filter(
    (place) => !isRetailEmbeddedHealth(place),
  );

  if (!placeResults.length) {
    placesResponse = await googleMapsClient.textSearch({
      params: {
        key: googleMapsApiKey,
        query: 'urgent care clinic',
        location: originLatLng,
        radius: 50000,
      },
    });
    placeResults = (placesResponse.data.results || []).filter(
      (place) => !isRetailEmbeddedHealth(place),
    );
  }

  const place = placeResults[0];
  if (!place) {
    throw new Error('No urgent care clinic found near that address.');
  }

  const result = {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

// Finds nearby interstates by geocoding each highway name near the address city/state.
// Validates the returned result actually mentions the highway to filter out false matches.
// Shows the closest as primary, lists others within 20 minutes in the note.
async function findNearestHighwayOnRamp(originLatLng) {
  const cacheKey = `highway:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const reverseGeoResponse = await googleMapsClient.reverseGeocode({
    params: {
      key: googleMapsApiKey,
      latlng: originLatLng,
    },
  });

  const geoComponents = reverseGeoResponse.data.results?.[0]?.address_components || [];
  const city = geoComponents.find((c) => c.types.includes('locality'))?.long_name || '';
  const state = geoComponents.find((c) => c.types.includes('administrative_area_level_1'))?.short_name || '';
  const locationLabel = city && state ? `${city}, ${state}` : originLatLng;

  const interstates = [
    'I-5',  'I-8',  'I-10', 'I-11', 'I-12', 'I-15', 'I-16', 'I-17', 'I-19',
    'I-20', 'I-22', 'I-24', 'I-25', 'I-26', 'I-27', 'I-29', 'I-30', 'I-35',
    'I-37', 'I-38', 'I-39', 'I-40', 'I-41', 'I-43', 'I-44', 'I-49', 'I-55',
    'I-57', 'I-59', 'I-64', 'I-65', 'I-69', 'I-70', 'I-71', 'I-72', 'I-73',
    'I-74', 'I-75', 'I-76', 'I-77', 'I-78', 'I-79', 'I-80', 'I-81', 'I-82',
    'I-83', 'I-84', 'I-85', 'I-86', 'I-87', 'I-88', 'I-89', 'I-90', 'I-93',
    'I-94', 'I-95', 'I-96', 'I-97', 'I-99',
  ];

  const geocodeResults = await Promise.all(
    interstates.map(async (highway) => {
      try {
        const response = await googleMapsClient.geocode({
          params: {
            key: googleMapsApiKey,
            address: `${highway} near ${locationLabel}`,
          },
        });
        const result = response.data.results?.[0];
        if (!result) return null;

        const returned = (result.formatted_address || '').toUpperCase();
        const num = highway.replace('I-', '');
        const isReal =
          returned.includes(highway.toUpperCase()) ||
          returned.includes(`INTERSTATE ${num}`) ||
          returned.includes(`I-${num}`) ||
          returned.includes(`I ${num}`);

        if (!isReal) return null;

        return {
          highway,
          location: result.geometry.location,
          address: result.formatted_address,
        };
      } catch {
        return null;
      }
    }),
  );

  const validGeoResults = geocodeResults.filter(Boolean);
  if (!validGeoResults.length) {
    throw new Error('No interstate highways found near that address.');
  }

  const withDriveTimes = await Promise.all(
    validGeoResults.map(async (result) => {
      try {
        const driveTimeMinutes = await getDriveTime(originLatLng, result.location);
        return { ...result, driveTimeMinutes };
      } catch {
        return null;
      }
    }),
  );

  const allValid = withDriveTimes.filter(Boolean);

  // Google's geocoder returns a representative midpoint for a highway in the state,
  // not the nearest on-ramp. "I-64 near Georgetown, KY" gives a point 35 min away,
  // but the I-64/I-75 interchange in Lexington is only 14 min away. For interstates
  // whose geocoded point is >20 min but ≤50 min, try the junction with the nearest
  // already-validated within-20 interstate to find the real closest access.
  const primary20 = allValid
    .filter((r) => r.driveTimeMinutes <= 20)
    .sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);

  if (primary20.length && state) {
    const nearestHwy = primary20[0];
    const borderline = allValid.filter((r) => r.driveTimeMinutes > 20 && r.driveTimeMinutes <= 50);

    const interchangeResults = await Promise.all(
      borderline.map(async (farHwy) => {
        try {
          const response = await googleMapsClient.geocode({
            params: {
              key: googleMapsApiKey,
              address: `${farHwy.highway}/${nearestHwy.highway} ${state}`,
            },
          });
          const result = response.data.results?.[0];
          if (!result) return null;

          const returned = (result.formatted_address || '').toUpperCase();
          const num = farHwy.highway.replace('I-', '');
          const isReal =
            returned.includes(farHwy.highway.toUpperCase()) ||
            returned.includes(`INTERSTATE ${num}`) ||
            returned.includes(`I-${num}`) ||
            returned.includes(`I ${num}`);
          if (!isReal) return null;

          const driveTimeMinutes = await getDriveTime(originLatLng, result.geometry.location);
          if (driveTimeMinutes > 20) return null;

          return {
            highway: farHwy.highway,
            location: result.geometry.location,
            address: result.formatted_address,
            driveTimeMinutes,
          };
        } catch {
          return null;
        }
      }),
    );

    for (const r of interchangeResults) {
      if (r && !allValid.some((v) => v.highway === r.highway && v.driveTimeMinutes <= 20)) {
        allValid.push(r);
      }
    }
  }

  const nearby = allValid
    .filter((r) => r.driveTimeMinutes <= 20)
    .sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);

  const candidates = nearby.length
    ? nearby
    : allValid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes).slice(0, 1);

  if (!candidates.length) {
    throw new Error('Unable to calculate drive times to nearby interstate highways.');
  }

  const primary = candidates[0];
  const othersNote = candidates.length > 1
    ? `Also within 20 minutes: ${candidates.slice(1).map((c) => `${c.highway} (${c.driveTimeMinutes} min)`).join(', ')}`
    : null;

  const result = {
    name: primary.highway,
    address: primary.address,
    location: primary.location,
    driveTimeMinutes: primary.driveTimeMinutes,
    note: othersNote,
  };
  placesCache.set(cacheKey, result);
  return result;
}

// Returns nearest school by distance.
// Note: nearest by distance is not the assigned school for the parcel.
// Assigned school requires verification with the school district.
const SCHOOL_PLACE_TYPES = new Set(['school', 'primary_school', 'secondary_school', 'university']);
const SCHOOL_NAME_TERMS = /school|elementary|middle|high\s+school|academy|college|university|institute|charter|magnet|preparatory|prep\s+school|learning\s+center|educational/i;

function isValidSchoolPlace(p) {
  const hasSchoolType = (p.types || []).some((t) => SCHOOL_PLACE_TYPES.has(t));
  const hasSchoolName = SCHOOL_NAME_TERMS.test(p.name || '');
  return hasSchoolType && hasSchoolName;
}

async function findNearestSchool(originLatLng) {
  const cacheKey = `school:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  let placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'school',
    },
  });

  let placeResults = placesResponse.data.results || [];

  // Fallback to text search if placesNearby returned nothing or no valid school
  if (!placeResults.some(isValidSchoolPlace)) {
    placesResponse = await googleMapsClient.textSearch({
      params: {
        key: googleMapsApiKey,
        query: 'school',
        location: originLatLng,
        radius: 25000,
      },
    });
    placeResults = placesResponse.data.results || [];
  }

  // Require both a school place type AND a school-related name
  const place = placeResults.find(isValidSchoolPlace);
  if (!place) {
    throw new Error('No school found near that address.');
  }

  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
    note: 'This is the nearest school by distance. Assigned school for this address requires verification directly with the school district.',
  };
  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestGasStation(originLatLng) {
  const cacheKey = `gasstation:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'gas_station',
    },
  });
  const place = (placesResponse.data.results || [])[0];
  if (!place) throw new Error('No gas station found near that address.');
  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

const PARK_EXCLUDED_TYPES = ['local_government_office', 'lawyer', 'insurance_agency', 'political'];
const PARK_LEISURE_TYPES = ['park', 'natural_feature', 'campground', 'amusement_park', 'zoo', 'stadium', 'gym', 'recreation_area'];

function isValidPark(p) {
  const types = p.types || [];
  if (PARK_EXCLUDED_TYPES.some((t) => types.includes(t))) return false;
  if (types.includes('establishment') && !PARK_LEISURE_TYPES.some((t) => types.includes(t))) return false;
  return true;
}

async function findNearestPark(originLatLng) {
  const cacheKey = `park:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'park',
    },
  });
  const place = (placesResponse.data.results || []).find(isValidPark);
  if (!place) throw new Error('No park found near that address.');
  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestCoffeeShop(originLatLng) {
  const cacheKey = `coffeeshop:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'cafe',
    },
  });

  const candidates = (placesResponse.data.results || []).slice(0, 5);
  if (!candidates.length) throw new Error('No coffee shop found near that address.');

  const withDriveTimes = await Promise.all(
    candidates.map(async (place) => {
      try {
        const driveTimeMinutes = await getDriveTime(originLatLng, place.geometry.location);
        return {
          name: place.name,
          address: place.vicinity || place.formatted_address || place.name,
          location: place.geometry.location,
          driveTimeMinutes,
        };
      } catch {
        return null;
      }
    }),
  );

  const valid = withDriveTimes.filter(Boolean);
  valid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);
  const result = valid[0];
  if (!result) throw new Error('No coffee shop found near that address.');
  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestElementarySchool(originLatLng) {
  const cacheKey = `elementary:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }

  const exclusions = ['preschool', 'pre-school', 'daycare', 'day care', 'montessori', 'private'];
  const placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'public elementary school',
      location: originLatLng,
      radius: 15000,
    },
  });
  const place = (placesResponse.data.results || []).filter(
    (p) => !isExcludedPlaceName(p.name, exclusions),
  )[0];
  if (!place) throw new Error('No elementary school found near that address.');
  const result = {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDriveTime(minutes) {
  return `${minutes} min`;
}

const STATE_ABBRS = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);

function toTitleCase(str) {
  return str.replace(/\w+/g, (word) => {
    if (word.length === 2 && STATE_ABBRS.has(word.toUpperCase())) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function parseAddressParts(address) {
  const commaIdx = address.indexOf(',');
  if (commaIdx === -1) return { street: address, cityState: '' };
  return {
    street: address.slice(0, commaIdx).trim(),
    cityState: address.slice(commaIdx + 1).trim(),
  };
}

function formatResearchDate() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildGrocerySection(stores) {
  const label = '<div class="dest-label">Grocery Stores</div>';
  if (!stores || !stores.length) {
    return `<div class="dest-section">${label}<p class="dest-note">Grocery store data was not available for this address. <a href="https://www.google.com/maps/search/grocery+store+near+me" target="_blank" rel="noopener">Search Google Maps</a> for nearby options.</p></div>`;
  }
  const items = stores.map((s) => `
      <div class="grocery-item">
        <div>
          <div class="dest-name">${escapeHtml(s.name)}</div>
          <div class="dest-address">${escapeHtml(s.address)}</div>
        </div>
        <div class="drive-time">${formatDriveTime(s.driveTimeMinutes)}</div>
      </div>`).join('');
  return `<div class="dest-section">
      ${label}${items}
    </div>`;
}

function buildDestSection(label, result) {
  const labelHTML = `<div class="dest-label">${label}</div>`;
  if (!result) {
    const searchQuery = encodeURIComponent(`${label} near me`);
    return `<div class="dest-section">${labelHTML}<p class="dest-note">Data not available for this address. <a href="https://www.google.com/maps/search/${searchQuery}" target="_blank" rel="noopener">Search Google Maps</a> for nearby options.</p></div>`;
  }
  const noteHTML = result.note ? `<p class="dest-note">${escapeHtml(result.note)}</p>` : '';
  return `<div class="dest-section">
      ${labelHTML}
      <div class="dest-row">
        <div>
          <div class="dest-name">${escapeHtml(result.name)}</div>
          <div class="dest-address">${escapeHtml(result.address)}</div>
        </div>
        <div class="drive-time">${formatDriveTime(result.driveTimeMinutes)}</div>
      </div>
      ${noteHTML}
    </div>`;
}

function buildSchoolSection(school) {
  const label = '<div class="dest-label">School (Nearest by Distance)</div>';
  if (!school) {
    return `<div class="dest-section">${label}<p class="dest-note">School data was not available for this address. Contact the local school district office directly to confirm which school serves this address.</p></div>`;
  }
  const disclaimer = school.note || 'Assigned school for this address requires verification directly with the school district.';
  return `<div class="dest-section">
      ${label}
      <div class="dest-row">
        <div>
          <div class="dest-name">${escapeHtml(school.name)}</div>
          <div class="dest-address">${escapeHtml(school.address)}</div>
        </div>
        <div class="drive-time">${formatDriveTime(school.driveTimeMinutes)}</div>
      </div>
      <p class="dest-note"><span class="bucket-tag">Things to Check</span>${escapeHtml(disclaimer)}</p>
    </div>`;
}

function generateDailyConveniencesNarrative(grocery, pharmacy, gasStation) {
  const g = Array.isArray(grocery) ? grocery[0] : grocery;
  const stores = Array.isArray(grocery) ? grocery : (grocery ? [grocery] : []);
  const times = [g, pharmacy, gasStation].filter(Boolean).map((s) => s.driveTimeMinutes);
  if (!times.length) return null;
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

  let opening;
  if (avg < 8) opening = 'Daily errands are genuinely effortless here—everything you need is within a short drive.';
  else if (avg < 15) opening = "A quick drive covers the essentials. You're close enough that nothing feels like a production.";
  else if (avg < 25) opening = 'Services are accessible, just not around the corner. Most residents plan ahead and batch errands together.';
  else opening = "This is a location where you plan ahead. Services are farther out, so keeping a well-stocked home becomes part of the rhythm.";

  const paragraphs = [];

  if (g) {
    let gPara = `Your nearest grocery option is ${g.name}, ${g.driveTimeMinutes} minutes away.`;
    if (stores.length > 1 && stores[1]) {
      gPara += ` ${stores[1].name} is another option at ${stores[1].driveTimeMinutes} minutes—useful if you want variety or have store preferences.`;
    } else if (g.driveTimeMinutes <= 8) {
      gPara += " That's close enough to make mid-week top-offs practical, not just big Sunday hauls.";
    } else {
      gPara += ' Most residents find it easiest to do one bigger weekly shop rather than multiple trips.';
    }
    paragraphs.push(gPara);
  }

  const p2Parts = [];
  if (pharmacy) p2Parts.push(`Pharmacy runs take ${pharmacy.driveTimeMinutes} minutes to ${pharmacy.name}—convenient for prescriptions or last-minute needs.`);
  if (gasStation) p2Parts.push(`The nearest gas station is ${gasStation.driveTimeMinutes} minutes at ${gasStation.name}.`);
  if (p2Parts.length) paragraphs.push(p2Parts.join(' '));

  if (avg < 10) {
    paragraphs.push("Most people don't think twice about running out for a forgotten ingredient or picking up a prescription after work. That's the kind of low-friction living this location offers.");
  } else if (avg < 20) {
    paragraphs.push("The distance is easy to build into a routine—swing by on the way home, combine trips, and it rarely becomes a burden. The flip side: you're far enough out that this still feels like a neighborhood, not a strip mall parking lot.");
  } else {
    paragraphs.push("If quiet and space matter more to you than convenience, this trade-off tends to feel worth it over time. The adjustment is real, but most people who choose locations like this say they'd do it again.");
  }

  const items = [
    g ? { label: 'Grocery', name: g.name, time: g.driveTimeMinutes } : null,
    pharmacy ? { label: 'Pharmacy', name: pharmacy.name, time: pharmacy.driveTimeMinutes } : null,
    gasStation ? { label: 'Gas', name: gasStation.name, time: gasStation.driveTimeMinutes } : null,
  ].filter(Boolean);

  return { opening, paragraphs, items };
}

function generatePeaceOfMindNarrative(hospital, urgentCare) {
  if (!hospital) return null;

  let opening;
  if (hospital.driveTimeMinutes < 10) opening = 'Medical care is genuinely close. You could cover the distance quickly in any situation.';
  else if (hospital.driveTimeMinutes < 20) opening = `The nearest hospital is ${hospital.driveTimeMinutes} minutes away—reassuring distance without being in the thick of a medical district.`;
  else if (hospital.driveTimeMinutes < 30) opening = `Hospital access takes ${hospital.driveTimeMinutes} minutes. Worth knowing the route before you ever actually need it.`;
  else opening = 'The nearest hospital is more than 30 minutes away. If immediate medical access matters to you—young children, elderly parents, chronic conditions—this is something to weigh seriously.';

  const paragraphs = [];

  let hPara = `${hospital.name} is the closest full-service hospital at ${hospital.driveTimeMinutes} minutes.`;
  if (hospital.driveTimeMinutes > 20) {
    hPara += " Save the route in your phone now. In a real emergency, you don't want to be searching for it.";
  } else {
    hPara += ' The kind of distance that\'s manageable in nearly any situation.';
  }
  paragraphs.push(hPara);

  if (urgentCare) {
    const ucPara = urgentCare.driveTimeMinutes < hospital.driveTimeMinutes - 5
      ? `For non-emergencies—ear infections, minor injuries, high fevers—${urgentCare.name} is closer at ${urgentCare.driveTimeMinutes} minutes. Urgent care handles the vast majority of situations that don't require a full ER, often with shorter waits and lower bills.`
      : `${urgentCare.name} provides urgent care ${urgentCare.driveTimeMinutes} minutes away. For anything short of a true emergency, it's often the smarter first stop than an ER.`;
    paragraphs.push(ucPara);
  }

  paragraphs.push('Worth doing before you need it: find a primary care physician and pediatrician nearby, and save a list of after-hours clinics on your phone. Five minutes of prep pays real dividends.');

  const items = [
    { label: 'Hospital', name: hospital.name, time: hospital.driveTimeMinutes },
    urgentCare ? { label: 'Urgent Care', name: urgentCare.name, time: urgentCare.driveTimeMinutes } : null,
  ].filter(Boolean);

  return { opening, paragraphs, items };
}

function generateGettingAroundNarrative(highwayRamp) {
  if (!highwayRamp) return null;

  let opening;
  if (highwayRamp.driveTimeMinutes < 5) opening = "Highway access is essentially immediate—you're on the ramp in under five minutes.";
  else if (highwayRamp.driveTimeMinutes < 10) opening = `The highway is ${highwayRamp.driveTimeMinutes} minutes away. Close enough for easy commuting, far enough to avoid interchange noise.`;
  else if (highwayRamp.driveTimeMinutes < 20) opening = `You're ${highwayRamp.driveTimeMinutes} minutes from the highway—a buffer from road noise and commercial traffic without sacrificing connectivity.`;
  else opening = `Highway access is ${highwayRamp.driveTimeMinutes} minutes from here. If you commute daily, test the drive during your actual rush hour before committing.`;

  const paragraphs = [];
  paragraphs.push(`${highwayRamp.name} is your nearest on-ramp at ${highwayRamp.driveTimeMinutes} minutes. Once you're on, you can cover significant ground quickly—regional employment centers, airports, and weekend destinations all become more reachable.`);

  if (highwayRamp.driveTimeMinutes < 8) {
    paragraphs.push("The proximity is an underrated advantage. Grocery runs, airport pickups, and visiting family all get easier when you're this close to a major route. The noise and commercial clutter that comes with being right at an interchange stays far enough back not to register.");
  } else if (highwayRamp.driveTimeMinutes >= 15) {
    paragraphs.push("If you work remotely or have a reverse commute, this distance barely registers in daily life. Daily commuters heading into a busy corridor should do a test run at actual rush hour—trip times often vary more than you'd expect depending on direction and congestion patterns.");
  }

  return {
    opening,
    paragraphs,
    items: [{ label: 'Highway Access', name: highwayRamp.name, time: highwayRamp.driveTimeMinutes }],
  };
}

function generateCallouts(grocery, pharmacy, hospital) {
  const g = Array.isArray(grocery) ? grocery[0] : grocery;
  const callouts = [];

  if (hospital && hospital.driveTimeMinutes > 30) {
    callouts.push({
      icon: '⚠️',
      title: 'Worth Noting',
      message: `The nearest hospital is ${hospital.driveTimeMinutes} minutes away. If immediate medical access is important to you, this is something to consider.`,
    });
  }

  if (g && g.driveTimeMinutes > 30) {
    callouts.push({
      icon: '⚠️',
      title: 'Worth Noting',
      message: `Grocery shopping takes ${g.driveTimeMinutes} minutes each way. You'll want to plan larger shopping trips and keep a well-stocked pantry.`,
    });
  }

  const avgTimes = [g, pharmacy, hospital].filter(Boolean).map((s) => s.driveTimeMinutes);
  if (avgTimes.length === 3) {
    const avg = Math.round(avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length);
    if (avg > 40) {
      callouts.push({
        icon: 'ℹ️',
        title: 'Heads Up',
        message: "This is a remote location. You'll enjoy peace, space, and privacy—but services are farther out. Most errands will be 30–45+ minutes.",
      });
    }
  }

  return callouts;
}

function buildInsightItemsHTML(items) {
  return items.map((item) => `
        <div class="insight-item">
          <span class="item-label">${escapeHtml(item.label)}</span>
          <span class="item-place">${escapeHtml(item.name)}</span>
          <span class="item-time">${item.time} min</span>
        </div>`).join('');
}

function buildInsightSectionHTML(icon, title, subtitle, narrative) {
  if (!narrative) return '';
  const parasHTML = (narrative.paragraphs || [])
    .map((p) => `<p class="insight-para">${escapeHtml(p)}</p>`)
    .join('');
  return `
    <div class="insight-section">
      <div class="insight-header">
        <span class="insight-icon">${icon}</span>
        <div>
          <div class="insight-title">${escapeHtml(title)}</div>
          <div class="insight-subtitle">${escapeHtml(subtitle)}</div>
        </div>
      </div>
      <p class="insight-opening">${escapeHtml(narrative.opening)}</p>
      ${parasHTML}
      <div class="insight-breakdown">
        ${buildInsightItemsHTML(narrative.items)}
      </div>
    </div>`;
}

function buildKeyInsightsHTML(hospital, school, highwayRamp, premium) {
  const findings = [];
  const env = premium?.environment;

  // 1. Flood zone — most actionable first
  const flood = env?.floodRisk;
  if (flood) {
    if (flood.risk === 'High' || flood.risk === 'Very High') {
      findings.push({ bucket: 'Things to Check', cls: 'check',
        text: `This parcel falls in FEMA Flood Zone ${flood.zone} — flood insurance is federally required and typically adds $1,500–$4,000/year to your carrying costs. Get a quote before you make an offer.` });
    } else if (flood.risk === 'Minimal' || flood.risk === 'Unknown' && flood.zone === 'X') {
      findings.push({ bucket: 'Cool Things to Know', cls: 'cool',
        text: `This address falls outside FEMA's high-risk flood zones (Zone X) — flood insurance is not federally required and the parcel-level risk is minimal.` });
    } else {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `This parcel is in FEMA Flood Zone ${flood.zone} — a moderate-risk area. Flood insurance isn't required here but is worth pricing before closing.` });
    }
  }

  // 2. School assignment
  if (school) {
    findings.push({ bucket: 'Things to Check', cls: 'check',
      text: `The nearest school is ${school.name} (${school.driveTimeMinutes} min) — your assigned school requires direct verification with the district. "Nearest" doesn't always mean "assigned."` });
  }

  // 3. Hospital distance
  if (hospital) {
    if (hospital.driveTimeMinutes > 20) {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `The nearest full-service ER is ${hospital.name}, ${hospital.driveTimeMinutes} minutes away — worth discussing with any household members who have health conditions that may require fast emergency access.` });
    } else if (hospital.driveTimeMinutes <= 10) {
      findings.push({ bucket: 'Cool Things to Know', cls: 'cool',
        text: `${hospital.name} is ${hospital.driveTimeMinutes} minutes away — a full-service emergency department within quick reach.` });
    } else {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `The nearest full-service ER, ${hospital.name}, is ${hospital.driveTimeMinutes} minutes away — reasonable for most situations, but know your route in advance.` });
    }
  }

  // 4. Highway access
  if (highwayRamp) {
    if (highwayRamp.driveTimeMinutes > 20) {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `${highwayRamp.name} access is ${highwayRamp.driveTimeMinutes} minutes away — regional travel or airport runs will take meaningfully longer from this address.` });
    } else if (highwayRamp.driveTimeMinutes <= 8) {
      findings.push({ bucket: 'Cool Things to Know', cls: 'cool',
        text: `${highwayRamp.name} is ${highwayRamp.driveTimeMinutes} minutes away — quick highway access for regional travel and commutes.` });
    } else {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `${highwayRamp.name} access is ${highwayRamp.driveTimeMinutes} minutes away — a moderate drive that adds up on regular regional trips.` });
    }
  }

  // 5. Radon (prefer) or Airport
  const radon = env?.radon;
  const airports = env?.airports;
  if (radon && radon.zone === 1) {
    findings.push({ bucket: 'Things to Check', cls: 'check',
      text: `This county is EPA Radon Zone 1 (high potential) — a $15–$30 radon test before closing is strongly recommended. Mitigation systems run $800–$2,500 if levels are elevated.` });
  } else if (airports && airports.length && airports[0].distanceMiles < 10) {
    const a = airports[0];
    findings.push({ bucket: 'Things to Consider', cls: 'consider',
      text: `${a.name} is ${a.distanceMiles.toFixed(1)} miles away — visit the property at 6–9am on a weekday before committing to assess actual aircraft noise levels.` });
  } else if (radon) {
    const zLabel = radon.zone === 2 ? 'Zone 2 (moderate)' : 'Zone 3 (lower risk)';
    findings.push({ bucket: 'Things to Consider', cls: 'consider',
      text: `This county is EPA Radon ${zLabel} — a quick $15–$30 radon test remains a worthwhile precaution before purchase.` });
  }

  if (!findings.length) return '';
  const top = findings.slice(0, 5);

  const rowsHTML = top.map((f) => `
    <div class="key-insight-row">
      <span class="key-insight-bucket ki-${escapeHtml(f.cls)}">${escapeHtml(f.bucket)}</span>
      <p class="key-insight-text">${escapeHtml(f.text)}</p>
    </div>`).join('');

  return `
  <div class="chapter-card key-insights-card">
    <div class="chapter-header">
      <div class="chapter-label">Before You Read Further</div>
      <div class="chapter-title">At a Glance</div>
    </div>
    <div class="chapter-body">
      <p class="key-insights-intro">Five things worth knowing before you dig into the details.</p>
      ${rowsHTML}
    </div>
  </div>`;
}

function buildHealthSafetyChapterHTML(hospital, emergency) {
  if (!hospital && !emergency) return '';
  const fire   = emergency?.fire;
  const police = emergency?.police;

  // ── ER narrative ────────────────────────────────────────────────────────────
  let erHTML = '';
  if (hospital) {
    const mins = hospital.driveTimeMinutes;
    const narrative =
      mins <= 10
        ? `${escapeHtml(hospital.name)} is ${mins} minutes away — a full-service emergency department within quick reach. For cardiac events or serious trauma, that proximity matters.`
        : mins <= 20
          ? `${escapeHtml(hospital.name)} is ${mins} minutes away. That's workable for most emergencies, though not the fastest access. Drive the route on a weekday morning before you close — traffic patterns at 8am can add several minutes.`
          : `${escapeHtml(hospital.name)} is ${mins} minutes away — extended for a time-critical emergency. This doesn't disqualify a property, but it raises the importance of smoke detectors, CO alarms, and basic first aid readiness in the household.`;
    erHTML = `<p class="ch01-er-text">${narrative}</p>`;
  }

  // ── Station rows ─────────────────────────────────────────────────────────────
  function stationRow(icon, label, station) {
    if (!station) return '';
    const { estimate, category } = station.response;
    const badgeStyle = category.color === 'green'  ? 'background:#e8f5ee;color:#2a6640'
                     : category.color === 'gold'   ? 'background:#fdf3dc;color:#7a5c10'
                     : category.color === 'orange' ? 'background:#fff0e0;color:#8a4f10'
                     :                               'background:#fee;color:#8a1010';
    return `
      <div class="ch01-station-row">
        <span class="ch01-station-icon">${icon}</span>
        <div class="ch01-station-info">
          <span class="ch01-station-name">${escapeHtml(station.name)}</span>
          <span class="ch01-station-dist">${station.distanceMiles} mi</span>
        </div>
        <span class="ch01-response-badge" style="${badgeStyle}">~${estimate} min · ${escapeHtml(category.label)}</span>
      </div>`;
  }

  const stationsHTML = [stationRow('🚒', 'Fire', fire), stationRow('🚔', 'Police/EMS', police)].join('');

  // ── Key Takeaway ─────────────────────────────────────────────────────────────
  let takeaway;
  const erMins  = hospital?.driveTimeMinutes;
  const fireMins = fire?.response?.estimate;
  if (fireMins > 12) {
    takeaway = `Fire response of ~${fireMins} min means a fire can spread significantly before suppression arrives. Ask your insurance agent for the ISO PPC rating for this address — it directly affects your fire coverage premium and is address-specific.`;
  } else if (erMins > 20) {
    takeaway = `The nearest full-service ER is ${erMins} minutes away. Make sure every adult in the household knows the route, and keep a basic first aid kit stocked.`;
  } else if (fireMins <= 5 && erMins <= 10) {
    takeaway = `Fast fire response (~${fireMins} min) and a close ER (${erMins} min) are genuine safety assets here. Still ask your insurance agent for the ISO PPC rating — it's address-specific and free to look up.`;
  } else {
    takeaway = `Response times and ER access are within normal range for this area. Confirm the ISO fire protection class with your insurance agent before closing — it sets your fire coverage rate and takes one phone call.`;
  }

  // ── Things to Check ──────────────────────────────────────────────────────────
  const checks = [
    { icon: '🔐', label: 'Get the ISO fire protection rating', detail: 'Ask your homeowner\'s insurance agent for the ISO PPC rating for this specific address. It\'s free, takes one phone call, and directly determines your annual fire coverage cost. Ratings 1–4 are excellent; 8–10 indicate limited coverage and higher premiums.' },
    { icon: '🏥', label: 'Drive the ER route before you close', detail: `${hospital ? `${escapeHtml(hospital.name)} is your nearest full-service ER.` : 'Locate your nearest full-service ER.'} Drive the actual route on a weekday morning — GPS timing and real traffic at 8am can differ. Know which entrance to use for emergencies.` },
    { icon: '🔥', label: 'Test detectors on move-in day', detail: 'Confirm working smoke detectors in every bedroom and hallway and a working CO detector on each floor. Replace batteries regardless of what the seller says. A $20 investment.' },
  ];

  const checksHTML = checks.map((c) => `
    <div class="ch01-check-row">
      <span class="ch01-check-icon">${c.icon}</span>
      <div class="ch01-check-text">
        <div class="ch01-check-label">${escapeHtml(c.label)}</div>
        <p class="ch01-check-detail">${c.detail}</p>
      </div>
    </div>`).join('');

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return `
  <div class="chapter-card">
    <div class="chapter-header">
      <div class="chapter-label">Chapter 1</div>
      <div class="chapter-title">Health &amp; Safety</div>
    </div>
    <div class="chapter-body">
      ${erHTML}
      ${stationsHTML ? `<div class="ch01-stations">${stationsHTML}</div>` : ''}
      ${checksHTML ? `<div class="ch01-checks"><div class="ch01-checks-label">Things to Check</div>${checksHTML}</div>` : ''}
      <div class="ch01-takeaway">
        <span class="ch01-takeaway-key">🔑</span>
        <p><strong>Key Takeaway:</strong> ${escapeHtml(takeaway)}</p>
      </div>
      <p class="ch01-disclaimer">Response times are estimates based on station distance and typical dispatch speeds. Actual times vary by call volume and unit availability. Research date: ${today}.</p>
    </div>
  </div>`;
}

function buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation) {
  const daily = generateDailyConveniencesNarrative(grocery, pharmacy, gasStation);
  const peace = generatePeaceOfMindNarrative(hospital, urgentCare);
  const getting = generateGettingAroundNarrative(highwayRamp);
  const callouts = generateCallouts(grocery, pharmacy, hospital);

  const sectionsHTML = [
    buildInsightSectionHTML('🛒', 'Daily Conveniences', 'The errands and routines that shape your week', daily),
    buildInsightSectionHTML('🏥', 'Peace of Mind', 'Healthcare access when it matters most', peace),
    buildInsightSectionHTML('🛣️', 'Getting Around', 'Connectivity to work, family, and beyond', getting),
  ].join('');

  const calloutsHTML = callouts.map((c) => `
    <div class="insight-callout">
      <span class="callout-icon">${c.icon}</span>
      <div class="callout-body">
        <div class="callout-title">${escapeHtml(c.title)}</div>
        <p class="callout-message">${escapeHtml(c.message)}</p>
      </div>
    </div>`).join('');

  if (!sectionsHTML.trim() && !calloutsHTML.trim()) return '';

  return `
  <div class="chapter-card">
    <div class="chapter-header">
      <div class="chapter-label">Things to Know</div>
      <div class="chapter-title">What Daily Life Looks Like Here</div>
    </div>
    <div class="chapter-body insights-body">
      <p class="insights-intro">The stuff you'd only learn after living here for two years—or by reading this.</p>
      ${sectionsHTML}${calloutsHTML}
    </div>
  </div>`;
}

const CUSTOM_DEST_ICONS = { work: '💼', family: '🏠', medical: '⚕️', recreation: '⛳', other: '📍' };

function buildCustomDestinationsCardHTML(customDestinations) {
  if (!customDestinations || !customDestinations.length) return '';

  const itemsHTML = customDestinations.map((dest) => {
    const icon = CUSTOM_DEST_ICONS[dest.type] || '📍';
    const timeHTML = dest.driveTimeMinutes != null
      ? `<div class="custom-dest-time">${formatDriveTime(dest.driveTimeMinutes)}</div>`
      : `<div class="custom-dest-time-na">—</div>`;
    return `
    <div class="custom-dest-item">
      <div class="custom-dest-icon">${icon}</div>
      <div class="custom-dest-info">
        <div class="custom-dest-name">${escapeHtml(dest.name)}</div>
        <div class="custom-dest-addr">${escapeHtml(dest.address)}</div>
      </div>
      ${timeHTML}
    </div>`;
  }).join('');

  return `
  <div class="custom-dests-card">
    <div class="custom-dests-card-header">
      <div class="custom-dests-card-eyebrow">Your Places</div>
      <div class="custom-dests-card-title">Custom Destinations</div>
    </div>
    ${itemsHTML}
  </div>`;
}

function buildAdditionalServicesCardHTML(elementarySchool, park, coffeeShop) {
  if (!elementarySchool && !park && !coffeeShop) return '';

  const narrativeParts = [];
  if (coffeeShop) {
    narrativeParts.push(coffeeShop.driveTimeMinutes <= 5
      ? `${coffeeShop.name} is ${coffeeShop.driveTimeMinutes} minutes away—close enough to become a morning habit.`
      : `There's coffee nearby at ${coffeeShop.name}, ${coffeeShop.driveTimeMinutes} minutes out.`);
  }
  if (park) {
    narrativeParts.push(park.driveTimeMinutes <= 5
      ? `${park.name} is ${park.driveTimeMinutes} minutes away—the kind of proximity that actually changes how you use your weekends.`
      : `${park.name} is ${park.driveTimeMinutes} minutes away for outdoor time.`);
  }
  if (elementarySchool) {
    narrativeParts.push(elementarySchool.driveTimeMinutes <= 5
      ? `The nearest elementary school is ${elementarySchool.driveTimeMinutes} minutes away. For families, that's a meaningful part of the morning routine.`
      : `The nearest elementary school is ${elementarySchool.driveTimeMinutes} minutes away—verify your assigned school directly with the district.`);
  }
  const narrativeHTML = narrativeParts.length
    ? `<p class="services-intro">${escapeHtml(narrativeParts.join(' '))}</p>`
    : '';

  return `
  <div class="chapter-card">
    <div class="chapter-header">
      <div class="chapter-label">Additional Places</div>
      <div class="chapter-title">More Nearby Destinations</div>
    </div>
    <div class="chapter-body">
      ${narrativeHTML}
      ${buildDestSection('Elementary School', elementarySchool)}
      ${buildDestSection('Park', park)}
      ${buildDestSection('Coffee Shop', coffeeShop)}
    </div>
  </div>`;
}

function buildTrafficItemHTML(name, traffic) {
  const { variations, stats } = traffic;
  const barsHTML = variations.map((v) => {
    const widthPct = stats.max > 0 ? Math.round((v.minutes / stats.max) * 100) : 100;
    const isBest = v.minutes === stats.min;
    const isWorst = v.minutes === stats.max && stats.range > 0;
    let barClass = 'traffic-bar-mid';
    if (isBest) barClass = 'traffic-bar-best';
    else if (isWorst) barClass = 'traffic-bar-worst';
    else if (v.minutes < stats.avg) barClass = 'traffic-bar-good';
    const tagHTML = isBest
      ? ' <span class="traffic-tag traffic-tag-best">Best</span>'
      : isWorst
      ? ' <span class="traffic-tag traffic-tag-worst">Worst</span>'
      : '';
    return `
      <div class="traffic-row">
        <span class="traffic-slot">${escapeHtml(v.display)}</span>
        <div class="traffic-bar-track"><div class="traffic-bar ${barClass}" style="width:${widthPct}%"></div></div>
        <span class="traffic-mins">${v.minutes}&nbsp;min${tagHTML}</span>
      </div>`;
  }).join('');

  const warningHTML = stats.range > 10 ? ' <span class="traffic-warning">High variation</span>' : '';
  return `
  <div class="traffic-dest-section">
    <div class="traffic-dest-name">${escapeHtml(name)}</div>
    ${barsHTML}
    <div class="traffic-stat-row">Avg ${stats.avg} min &nbsp;·&nbsp; Range ${stats.min}–${stats.max} min${warningHTML}</div>
  </div>`;
}

function buildTrafficCardHTML(trafficData) {
  if (!trafficData || !trafficData.length) return '';
  const sectionsHTML = trafficData
    .map((t, i) => (i > 0 ? '<div class="traffic-section-divider"></div>' : '') + buildTrafficItemHTML(t.name, t.traffic))
    .join('');
  return `
  <div class="chapter-card">
    <div class="chapter-header">
      <div class="chapter-label">Drive Times</div>
      <div class="chapter-title">Traffic Patterns</div>
    </div>
    <div class="chapter-body traffic-body">
      <p class="traffic-intro">Drive times aren't fixed—they shift significantly based on when you leave. The bars below show how your commute varies across rush hour, midday, and weekends so you can build a realistic picture of daily travel. If you're considering a regular commute, the "Worst" time is the one to internalize.</p>
      ${sectionsHTML}
    </div>
  </div>`;
}

function buildHeroQuickStatsHTML(grocery, coffeeShop, premium, elementarySchool, school) {
  const stats = [];

  if (coffeeShop?.driveTimeMinutes != null) {
    stats.push({ icon: '☕', label: 'Coffee nearby', value: `${coffeeShop.driveTimeMinutes} min drive` });
  }
  if (grocery?.length) {
    stats.push({ icon: '🛒', label: 'Groceries', value: `${grocery[0].driveTimeMinutes} min drive` });
  }
  const walk = premium?.walkability;
  if (walk?.category?.label) {
    stats.push({ icon: '🚶', label: 'Walkability', value: walk.category.label });
  }
  const nearestSchool = elementarySchool || school;
  if (nearestSchool?.driveTimeMinutes != null) {
    stats.push({ icon: '🏫', label: 'Nearest school', value: `${nearestSchool.driveTimeMinutes} min drive` });
  }

  return stats.slice(0, 4).map(({ icon, label, value }) => `
      <div class="hero-stat">
        <div class="hero-stat-icon">${icon}</div>
        <div class="hero-stat-text">
          <span class="hero-stat-label">${escapeHtml(label)}</span>
          <span class="hero-stat-value">${escapeHtml(value)}</span>
        </div>
      </div>`).join('');
}

function buildReportHTML(address, { grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool, customDestinations, trafficData, origin, reportId, premium }) {
  const { street, cityState } = parseAddressParts(address);
  const researchDate = formatResearchDate();

  const sectionsHTML = [
    buildGrocerySection(grocery),
    buildDestSection('Pharmacy', pharmacy),
    buildDestSection('Hospital — Full Emergency Department', hospital),
    buildDestSection('Urgent Care', urgentCare),
    buildDestSection('Highway Access', highwayRamp),
    buildDestSection('Gas Station', gasStation),
    buildSchoolSection(school),
  ].join('\n');

  // Build map pin data from all non-null services
  const mapServices = [];
  if (grocery && grocery.length) {
    grocery.forEach((s) => {
      if (s?.location) mapServices.push({
        name: s.name, address: s.address, driveTimeMinutes: s.driveTimeMinutes,
        lat: s.location.lat, lng: s.location.lng,
        label: 'Grocery', category: 'grocery',
      });
    });
  }
  [
    { result: pharmacy,         label: 'Pharmacy',          category: 'healthcare' },
    { result: hospital,         label: 'Hospital',          category: 'healthcare' },
    { result: urgentCare,       label: 'Urgent Care',       category: 'healthcare' },
    { result: highwayRamp,      label: highwayRamp?.name || 'Highway', category: 'transit' },
    { result: school,           label: 'School',            category: 'education' },
    { result: gasStation,       label: 'Gas Station',       category: 'transit' },
    { result: park,             label: 'Park',              category: 'parks' },
    { result: coffeeShop,       label: 'Coffee Shop',       category: 'coffee' },
    { result: elementarySchool, label: 'Elementary School', category: 'education' },
  ].forEach(({ result, label, category }) => {
    if (result?.location) mapServices.push({
      name: result.name, address: result.address, driveTimeMinutes: result.driveTimeMinutes,
      lat: result.location.lat, lng: result.location.lng, label, category,
    });
  });

  if (customDestinations) {
    customDestinations.forEach((dest) => {
      if (dest?.location) mapServices.push({
        name: dest.name, address: dest.address, driveTimeMinutes: dest.driveTimeMinutes,
        lat: dest.location.lat, lng: dest.location.lng, label: dest.name, category: 'custom',
      });
    });
  }

  const insightsCardHTML = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
  const additionalServicesCardHTML = buildAdditionalServicesCardHTML(elementarySchool, park, coffeeShop);
  const customDestinationsCardHTML = buildCustomDestinationsCardHTML(customDestinations);
  const trafficCardHTML = buildTrafficCardHTML(trafficData);
  const premiumSectionsHTML = buildPremiumSectionsHTML(premium || null);
  const keyInsightsHTML = buildKeyInsightsHTML(hospital, school, highwayRamp, premium);
  const healthSafetyChapterHTML = buildHealthSafetyChapterHTML(hospital, premium?.emergency);

  const safeAddrJS = JSON.stringify(address).replace(/</g, '\\u003c');
  const saveHistoryScriptHTML = `
  <script>
    (function () {
      try {
        var addr = ${safeAddrJS};
        var hist = JSON.parse(localStorage.getItem('livablyHistory') || '[]');
        var idx = hist.findIndex(function (h) { return h.address === addr; });
        if (idx !== -1) hist.splice(idx, 1);
        hist.unshift({ address: addr, timestamp: Date.now(), id: String(Date.now()) });
        if (hist.length > 50) hist.pop();
        localStorage.setItem('livablyHistory', JSON.stringify(hist));
      } catch (e) {}
    })();
  <\/script>`;

  const mapData = origin ? { home: { lat: origin.lat, lng: origin.lng }, services: mapServices } : null;
  const safeMapJSON = mapData ? JSON.stringify(mapData).replace(/</g, '\\u003c') : null;

  // Quick stats for the hero info card
  const quickStatsHTML = buildHeroQuickStatsHTML(grocery, coffeeShop, premium, elementarySchool, school);

  // Share button lives in the hero; script wires it up
  const heroShareHTML = reportId ? `
    <button id="shareBtn" class="hero-share-btn no-print">Share this report</button>
    <span id="shareToast" class="hero-share-toast hidden">Link copied!</span>` : '';

  const shareScriptHTML = reportId ? `
  <script>
    (function () {
      var id = '${reportId}';
      var btn = document.getElementById('shareBtn');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var url = window.location.origin + '/r/' + id;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(showToast).catch(function () { prompt('Copy this link:', url); });
        } else {
          prompt('Copy this link:', url);
        }
      });
      function showToast() {
        var t = document.getElementById('shareToast');
        if (!t) return;
        t.classList.remove('hidden');
        setTimeout(function () { t.classList.add('hidden'); }, 3000);
      }
    })();
  <\/script>` : '';

  // Hero map HTML (map + detail panel + toggles live inside .hero)
  const heroMapHTML = mapData ? `
    <div class="hero-map-container no-print">
      <div id="map" class="hero-map"></div>
    </div>
    <div class="hero-category-toggles no-print" id="mapControls">
      <button class="map-toggle active" data-cat="all">All</button>
      <button class="map-toggle" data-cat="education">🏫 Schools</button>
      <button class="map-toggle" data-cat="healthcare">🏥 Healthcare</button>
      <button class="map-toggle" data-cat="grocery">🛒 Grocery</button>
      <button class="map-toggle" data-cat="coffee">☕ Coffee</button>
      <button class="map-toggle" data-cat="parks">🌳 Parks</button>${mapData.services.some((s) => s.category === 'custom') ? '\n      <button class="map-toggle" data-cat="custom">⭐ Custom</button>' : ''}
    </div>
    <div id="map-detail" class="no-print">
      <div class="map-detail-pill"></div>
      <button id="map-detail-close" aria-label="Close">&#x2715;</button>
      <div class="map-detail-cat" id="map-detail-cat"></div>
      <div class="map-detail-name" id="map-detail-name"></div>
      <div class="map-detail-addr" id="map-detail-addr"></div>
      <span class="map-detail-time" id="map-detail-time"></span>
    </div>` : '';

  const mapScriptsHTML = mapData ? `
  <script id="map-data" type="application/json">${safeMapJSON}<\/script>
  <script>
    window.initMap = function () {
      try {
        var data = JSON.parse(document.getElementById('map-data').textContent);
        var home = { lat: data.home.lat, lng: data.home.lng };
        var map = new google.maps.Map(document.getElementById('map'), {
          center: home, zoom: 15,
          mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
          ],
        });

        var CAT_COLORS = {
          education: '#7B8E7F',
          healthcare: '#C27B5B',
          grocery:    '#B8956A',
          coffee:     '#7A6247',
          parks:      '#5B7A5E',
          transit:    '#9B9080',
          custom:     '#7A8FAD',
        };

        new google.maps.Marker({
          position: home, map: map, title: 'Your address', zIndex: 20,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#7B8E7F', fillOpacity: 1,
            strokeColor: '#ffffff', strokeWeight: 3, scale: 11,
          },
        });

        var svcMarkers = [];
        var detail = document.getElementById('map-detail');
        var detailCat  = document.getElementById('map-detail-cat');
        var detailName = document.getElementById('map-detail-name');
        var detailAddr = document.getElementById('map-detail-addr');
        var detailTime = document.getElementById('map-detail-time');

        function showDetail(svc) {
          detailCat.textContent  = svc.label || svc.category || '';
          detailName.textContent = svc.name;
          detailAddr.textContent = svc.address;
          detailTime.textContent = svc.driveTimeMinutes + ' min drive';
          if (detail) detail.classList.add('visible');
        }

        var closeBtn = document.getElementById('map-detail-close');
        if (closeBtn) closeBtn.addEventListener('click', function () {
          if (detail) detail.classList.remove('visible');
        });

        data.services.forEach(function (svc) {
          var pos = { lat: svc.lat, lng: svc.lng };
          var color = CAT_COLORS[svc.category] || '#9B9080';
          var marker = new google.maps.Marker({
            position: pos, map: map, title: svc.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: color, fillOpacity: 0.9,
              strokeColor: '#ffffff', strokeWeight: 2, scale: 8,
            },
          });
          marker._svc = svc;
          marker.addListener('click', function () { showDetail(svc); });
          svcMarkers.push(marker);
        });

        // Category toggle filtering
        var controls = document.getElementById('mapControls');
        if (controls) {
          controls.addEventListener('click', function (e) {
            var btn = e.target.closest('.map-toggle');
            if (!btn) return;
            controls.querySelectorAll('.map-toggle').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            var cat = btn.dataset.cat;
            if (detail) detail.classList.remove('visible');
            svcMarkers.forEach(function (m) {
              var show = cat === 'all' || (m._svc && m._svc.category === cat);
              m.setVisible(show);
            });
          });
        }
      } catch (e) {
        var el = document.getElementById('map');
        if (el) el.style.display = 'none';
      }
    };
  <\/script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${escapeHtml(googleMapsApiKey)}&callback=initMap" async defer><\/script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably Report — ${escapeHtml(address)}</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="report-page">
  <div class="hero">${heroMapHTML}
    <div class="hero-info-card">
      <div class="hero-card-brand">Liv<span class="logo-gold">ably</span></div>
      <h1 class="hero-info-street">${escapeHtml(street)}</h1>
      <div class="hero-info-city">${escapeHtml(cityState)}</div>${quickStatsHTML ? `
      <div class="hero-quick-stats">${quickStatsHTML}
      </div>` : ''}
    </div>${heroShareHTML}
    <div class="hero-scroll-indicator" aria-hidden="true">
      <span>Explore</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14m0 0l7-7m-7 7l-7-7"/>
      </svg>
    </div>
  </div>
  <div class="report-content">
    ${keyInsightsHTML}
    ${healthSafetyChapterHTML}
    ${insightsCardHTML}
    <div class="chapter-card">
      <div class="chapter-header">
        <div class="chapter-label">Core Services</div>
        <div class="chapter-title">Daily Reachability</div>
      </div>
      <div class="chapter-body">
        ${sectionsHTML}
      </div>
    </div>${additionalServicesCardHTML}${customDestinationsCardHTML}${trafficCardHTML}${premiumSectionsHTML}
    <footer class="footer">
      <div class="footer-brand">Liv<span class="logo-gold">ably</span></div>
      <div class="footer-meta">${researchDate} · ${escapeHtml(address)}</div>
      <div class="footer-legal">Drive times are estimates from Google Maps for 8am Tuesday departure. Assigned school requires verification with the local school district. For informational purposes only.</div>
      <div class="footer-actions no-print">
        <a id="pdfLink" href="#" class="btn-pdf" onclick="this.href='/report/pdf'+location.search.replace(/[?&]fetch=1/,'')">Download PDF</a>
      </div>
      <a href="/" class="back-link no-print">← Back to address form</a>
    </footer>
  </div>${mapScriptsHTML}${shareScriptHTML}${saveHistoryScriptHTML}
  <script src="/ui.js" defer><\/script>
</body>
</html>`;
}

function classifyError(error) {
  if (error instanceof QuotaExceededError) {
    return { type: 'QUOTA_EXCEEDED', title: 'Quota limit reached', message: error.message, retryAfter: null };
  }
  if (error instanceof RateLimitError) {
    return { type: 'RATE_LIMIT', title: "We're experiencing high demand", message: error.message, retryAfter: error.retryAfter || 30 };
  }
  const msg = (error.message || '').toLowerCase();
  const status = error.response?.status;
  if (msg.includes('unable to geocode')) {
    return { type: 'ADDRESS_NOT_FOUND', title: "We couldn't find that address", message: 'Check the spelling and try again.', retryAfter: null };
  }
  if (status === 429 || msg.includes('quota') || msg.includes('rate limit')) {
    return { type: 'RATE_LIMIT', title: 'High demand right now', message: 'Please try again in a moment.', retryAfter: 30 };
  }
  return { type: 'SERVER_ERROR', title: 'Something went wrong', message: 'An error occurred generating your report.', retryAfter: null };
}

const ERROR_ICONS = { ADDRESS_NOT_FOUND: '📍', RATE_LIMIT: '⏱️', QUOTA_EXCEEDED: '📊', SERVER_ERROR: '⚠️' };

function buildErrorHTML(type, title, message, address, retryAfter) {
  const icon = ERROR_ICONS[type] || '⚠️';
  const tryAgainLink = address
    ? `\n    <a href="/?address=${encodeURIComponent(address)}" class="btn-retry">Try again</a>`
    : '';

  const retryButtonHTML = retryAfter
    ? `<button id="retryBtn" class="btn-retry" disabled>Retry in <span id="countdown">${retryAfter}</span>s</button>`
    : '';

  const countdownScriptHTML = retryAfter ? `
  <script>
    (function () {
      var secs = ${Number(retryAfter)};
      var btn = document.getElementById('retryBtn');
      var countEl = document.getElementById('countdown');
      var iv = setInterval(function () {
        secs--;
        if (countEl) countEl.textContent = secs;
        if (secs <= 0) {
          clearInterval(iv);
          if (btn) { btn.disabled = false; btn.textContent = 'Retry Now'; }
        }
      }, 1000);
      if (btn) btn.addEventListener('click', function () { window.location.reload(); });
    })();
  <\/script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="livably-error" content="${escapeHtml(type)}">
  <title>Livably</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="error-page">
  <div class="error-container">
    <div class="error-icon">${icon}</div>
    <h1 class="error-title">${escapeHtml(title)}</h1>
    <p class="error-message">${escapeHtml(message)}</p>
    ${retryButtonHTML}${tryAgainLink}
    <a href="/" class="back-link">Try a different address</a>
  </div>${countdownScriptHTML}
</body>
</html>`;
}

function buildLoadingHTML(address) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably — Loading…</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="loading-page" data-address="${escapeHtml(address)}">
  <div class="loading-container">
    <div class="loading-logo">Liv<span class="logo-gold">ably</span></div>
    <div class="loading-spinner"></div>
    <p class="loading-message" id="loading-msg">Finding your address...</p>
  </div>
  <script>
    (function () {
      var messages = [
        'Finding your address...',
        'Locating nearby services...',
        'Calculating drive times...',
        'Generating your report...'
      ];
      var msgEl = document.getElementById('loading-msg');
      var idx = 0;
      var address = document.body.dataset.address;

      var cycleInterval = setInterval(function () {
        msgEl.style.opacity = '0';
        setTimeout(function () {
          idx = (idx + 1) % messages.length;
          msgEl.textContent = messages[idx];
          msgEl.style.opacity = '1';
        }, 300);
      }, 2500);

      setTimeout(function () {
        clearInterval(cycleInterval);
        msgEl.style.opacity = '0';
        setTimeout(function () {
          msgEl.textContent = 'This is taking longer than usual…';
          msgEl.style.opacity = '1';
        }, 300);
      }, 15000);

      function startCountdown(retryFn) {
        var secs = 30;
        msgEl.textContent = 'Too many requests. Retrying in ' + secs + 's…';
        var timer = setInterval(function () {
          secs--;
          if (secs <= 0) {
            clearInterval(timer);
            retryFn();
          } else {
            msgEl.textContent = 'Too many requests. Retrying in ' + secs + 's…';
          }
        }, 1000);
      }

      function reExecScripts(el) {
        el.querySelectorAll('script').forEach(function (old) {
          var s = document.createElement('script');
          for (var i = 0; i < old.attributes.length; i++) {
            s.setAttribute(old.attributes[i].name, old.attributes[i].value);
          }
          s.textContent = old.textContent;
          old.parentNode.replaceChild(s, old);
        });
      }

      function doFetch() {
        fetch('/report' + location.search + '&fetch=1')
          .then(function (res) { return res.text(); })
          .then(function (html) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');
            var errorMeta = doc.querySelector('meta[name="livably-error"]');
            if (errorMeta && errorMeta.getAttribute('content') === 'RATE_LIMIT') {
              clearInterval(cycleInterval);
              startCountdown(doFetch);
              return;
            }
            document.head.innerHTML = doc.head.innerHTML;
            document.body.className = doc.body.className;
            document.body.innerHTML = doc.body.innerHTML;
            reExecScripts(document.head);
            reExecScripts(document.body);
          })
          .catch(function () {
            clearInterval(cycleInterval);
            msgEl.style.opacity = '0';
            setTimeout(function () {
              msgEl.innerHTML = 'Connection issue. <a href="' + location.pathname + location.search + '">Try again</a>';
              msgEl.style.opacity = '1';
            }, 300);
          });
      }

      doFetch();
    })();
  <\/script>
</body>
</html>`;
}

app.get('/report', async (req, res) => {
  const address = req.query.address ? toTitleCase(req.query.address.trim()) : '';
  const isFetch = req.query.fetch === '1';

  if (!address) {
    return res.send(buildErrorHTML('SERVER_ERROR', 'No address provided', 'Please go back and enter an address.', null));
  }

  if (!googleMapsApiKey) {
    return res.send(buildErrorHTML('SERVER_ERROR', 'Configuration error', 'The server is missing required API credentials.', null));
  }

  if (!isFetch) {
    return res.send(buildLoadingHTML(address));
  }

  const _reqStart = Date.now();
  try {
    const origin = await geocodeAddress(address);
    const originLatLng = `${origin.lat},${origin.lng}`;

    // Reverse geocode for city/state/county — used by crime data and property data
    let locationInfo = null;
    try {
      const rgResp = await googleMapsClient.reverseGeocode({ params: { key: googleMapsApiKey, latlng: originLatLng } });
      const comps = rgResp.data.results?.[0]?.address_components || [];
      locationInfo = {
        city:   comps.find((c) => c.types.includes('locality'))?.long_name || '',
        state:  comps.find((c) => c.types.includes('administrative_area_level_1'))?.short_name || '',
        county: comps.find((c) => c.types.includes('administrative_area_level_2'))?.long_name || '',
        zip:    comps.find((c) => c.types.includes('postal_code'))?.long_name || '',
      };
    } catch {}

    const results = await Promise.allSettled([
      findNearestGrocery(originLatLng),
      findNearestPharmacy(originLatLng),
      findNearestHospital(originLatLng),
      findNearestUrgentCare(originLatLng),
      findNearestHighwayOnRamp(originLatLng),
      findNearestSchool(originLatLng),
      findNearestGasStation(originLatLng),
      findNearestPark(originLatLng),
      findNearestCoffeeShop(originLatLng),
      findNearestElementarySchool(originLatLng),
    ]);

    const [grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool] =
      results.map((r) => (r.status === 'fulfilled' ? r.value : null));

    const rawNames    = [].concat(req.query.customDestName    || []);
    const rawAddresses = [].concat(req.query.customDestAddress || []);
    const rawTypes    = [].concat(req.query.customDestType    || []);
    const rawCustomDests = [];
    for (let i = 0; i < Math.min(rawAddresses.length, 10); i++) {
      const addr = (rawAddresses[i] || '').trim();
      if (addr) rawCustomDests.push({ name: (rawNames[i] || 'Destination').trim(), address: addr, type: rawTypes[i] || 'other' });
    }

    const customDestResults = await Promise.allSettled(
      rawCustomDests.map(async ({ name, address: destAddr, type }) => {
        const location = await geocodeAddress(destAddr);
        const driveTimeMinutes = await getDriveTime(originLatLng, location);
        return { name, address: destAddr, type, location, driveTimeMinutes };
      }),
    );
    const customDestinations = customDestResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);

    // Traffic analysis for grocery, hospital, and work-type custom destinations
    const g0 = Array.isArray(grocery) ? grocery[0] : grocery;
    const trafficTargets = [];
    if (g0?.location) trafficTargets.push({ name: g0.name, location: g0.location });
    if (hospital?.location) trafficTargets.push({ name: hospital.name, location: hospital.location });
    customDestinations
      .filter((d) => d.type === 'work' && d.location)
      .forEach((d) => trafficTargets.push({ name: d.name, location: d.location }));

    const trafficResults = await Promise.allSettled(
      trafficTargets.map((t) => getTrafficVariations(originLatLng, t.location)),
    );
    const trafficData = trafficTargets
      .map((t, i) => ({ ...t, traffic: trafficResults[i].status === 'fulfilled' ? trafficResults[i].value : null }))
      .filter((t) => t.traffic !== null);

    const highwayDriveMinutes = highwayRamp?.driveTimeMinutes ?? null;
    let premium = null;
    try {
      premium = await getPremiumData({
        lat: origin.lat,
        lng: origin.lng,
        originLatLng,
        locationInfo,
        googleMapsClient,
        googleMapsApiKey,
        getDriveTime,
        highwayDriveMinutes,
      });
    } catch (premErr) {
      console.error('[Premium] fetch error:', premErr.message);
      logError('getPremiumData', address, premErr);
    }

    let reportId = null;
    try { reportId = saveReport(address); } catch {}
    logRequest(address, 'success', Date.now() - _reqStart);
    logAnalysis();
    return res.send(buildReportHTML(address, { grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool, customDestinations, trafficData, origin, reportId, premium }));
  } catch (error) {
    const { type, title, message, retryAfter } = classifyError(error);
    logError('report', address, error);
    logRequest(address, 'error', Date.now() - _reqStart, type);
    logAnalysis();
    return res.send(buildErrorHTML(type, title, message, address, retryAfter));
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────

app.get('/admin/health', (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || '';
  const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
  if (!isLocal) return res.status(403).send('Forbidden');

  let patterns = null;
  try { patterns = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/error-patterns.json'), 'utf8')); } catch {}
  const mitigations = loadMitigations();
  const recentErrors = readRecentLogs(1).filter((e) => e.type === 'error').slice(-20).reverse();
  const usage = getUsageStats();

  const pct = (n) => (n == null ? 'N/A' : `${(n * 100).toFixed(1)}%`);
  const flagged = Object.entries(patterns?.functions || {}).filter(([, f]) => f.flagged);

  const fnRows = Object.entries(patterns?.functions || {})
    .sort(([, a], [, b]) => b.failureRate - a.failureRate)
    .map(([fn, f]) => `
      <tr style="background:${f.flagged ? '#fff3cd' : 'transparent'}">
        <td style="padding:6px 10px;font-family:monospace;font-size:13px">${fn}</td>
        <td style="padding:6px 10px;text-align:right">${f.failures}</td>
        <td style="padding:6px 10px;text-align:right;color:${f.flagged ? '#b8922a' : '#1a1a1a'};font-weight:${f.flagged ? '600' : '400'}">${pct(f.failureRate)}</td>
        <td style="padding:6px 10px;font-size:12px;color:#555">${f.topErrors[0] || '—'}</td>
      </tr>`).join('');

  const mitRows = Object.entries(mitigations)
    .filter(([k]) => k !== 'updatedAt')
    .map(([fn, m]) => `
      <tr>
        <td style="padding:6px 10px;font-family:monospace;font-size:13px">${fn}</td>
        <td style="padding:6px 10px">${JSON.stringify(Object.fromEntries(Object.entries(m).filter(([k]) => !['reason','appliedAt'].includes(k))))}</td>
        <td style="padding:6px 10px;font-size:12px;color:#555">${m.reason || '—'}</td>
        <td style="padding:6px 10px;font-size:12px;color:#888">${m.appliedAt ? new Date(m.appliedAt).toLocaleDateString() : '—'}</td>
      </tr>`).join('');

  const errorRows = recentErrors.map((e) => `
    <tr>
      <td style="padding:5px 10px;font-size:12px;color:#888">${new Date(e.ts).toLocaleTimeString()}</td>
      <td style="padding:5px 10px;font-family:monospace;font-size:12px">${e.fn || '—'}</td>
      <td style="padding:5px 10px;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(e.address || '')}">${escapeHtml((e.address || '').slice(0, 40))}</td>
      <td style="padding:5px 10px;font-size:12px;color:#c0392b">${escapeHtml(e.errorMsg || '')}</td>
    </tr>`).join('');

  const apiRows = Object.entries(usage.byEndpoint || {})
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([ep, s]) => `
      <tr>
        <td style="padding:5px 10px;font-family:monospace;font-size:12px">${ep}</td>
        <td style="padding:5px 10px;text-align:right">${s.total}</td>
        <td style="padding:5px 10px;text-align:right">${s.total > 0 ? pct(s.success / s.total) : 'N/A'}</td>
      </tr>`).join('');

  const stats = patterns?.requestStats;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Livably — Health Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 24px; background: #faf8f4; color: #1a1a1a; font-family: 'DM Sans', sans-serif; font-size: 14px; }
    h1 { font-family: 'Fraunces', serif; font-size: 24px; margin: 0 0 4px; }
    h2 { font-family: 'Fraunces', serif; font-size: 16px; margin: 28px 0 10px; color: #1a1a1a; border-bottom: 1px solid #e0dcd4; padding-bottom: 6px; }
    .meta { color: #888; font-size: 12px; margin-bottom: 24px; }
    .cards { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
    .card { background: #fff; border: 1px solid #e0dcd4; border-radius: 8px; padding: 14px 20px; min-width: 140px; }
    .card-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
    .card-value { font-size: 26px; font-weight: 600; margin-top: 2px; }
    .card-value.warn { color: #b8922a; }
    .card-value.ok { color: #2e7d32; }
    .flag-banner { background: #fff3cd; border: 1px solid #b8922a; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e0dcd4; border-radius: 8px; overflow: hidden; }
    th { text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #888; background: #f4f1eb; border-bottom: 1px solid #e0dcd4; }
    tr + tr td { border-top: 1px solid #f0ece4; }
    .empty { color: #aaa; font-size: 13px; padding: 16px; text-align: center; }
  </style>
</head>
<body>
  <h1>Livably Health Dashboard</h1>
  <div class="meta">7-day window · analyzed ${patterns?.analyzedAt ? new Date(patterns.analyzedAt).toLocaleString() : 'never'} · API usage resets on restart</div>

  ${flagged.length ? `<div class="flag-banner">⚠️ <strong>${flagged.length} function${flagged.length > 1 ? 's' : ''} flagged:</strong> ${flagged.map(([fn, f]) => `${fn} (${pct(f.failureRate)})`).join(', ')}</div>` : ''}

  <div class="cards">
    <div class="card">
      <div class="card-label">Total Requests (7d)</div>
      <div class="card-value">${stats?.total ?? '—'}</div>
    </div>
    <div class="card">
      <div class="card-label">Success Rate (7d)</div>
      <div class="card-value ${stats?.successRate >= 0.9 ? 'ok' : stats?.successRate >= 0.7 ? 'warn' : 'warn'}">${pct(stats?.successRate)}</div>
    </div>
    <div class="card">
      <div class="card-label">Errors (7d)</div>
      <div class="card-value ${(stats?.error || 0) > 0 ? 'warn' : 'ok'}">${stats?.error ?? '—'}</div>
    </div>
    <div class="card">
      <div class="card-label">API Calls (24h)</div>
      <div class="card-value">${usage.last24h}</div>
    </div>
    <div class="card">
      <div class="card-label">API Success (24h)</div>
      <div class="card-value">${usage.successRate}</div>
    </div>
  </div>

  <h2>Function Failure Rates (7d)</h2>
  ${fnRows ? `<table><thead><tr><th>Function</th><th style="text-align:right">Failures</th><th style="text-align:right">Rate</th><th>Top Error</th></tr></thead><tbody>${fnRows}</tbody></table>` : '<p class="empty">No function errors recorded yet.</p>'}

  <h2>Active Mitigations</h2>
  ${mitRows ? `<table><thead><tr><th>Function</th><th>Value</th><th>Reason</th><th>Applied</th></tr></thead><tbody>${mitRows}</tbody></table>` : '<p class="empty">No mitigations active.</p>'}

  <h2>Recent Errors (today, last 20)</h2>
  ${errorRows ? `<table><thead><tr><th>Time</th><th>Function</th><th>Address</th><th>Error</th></tr></thead><tbody>${errorRows}</tbody></table>` : '<p class="empty">No errors logged today.</p>'}

  <h2>API Usage by Endpoint (24h)</h2>
  ${apiRows ? `<table><thead><tr><th>Endpoint</th><th style="text-align:right">Calls</th><th style="text-align:right">Success Rate</th></tr></thead><tbody>${apiRows}</tbody></table>` : '<p class="empty">No API calls recorded.</p>'}
</body>
</html>`);
});

async function generateComparisonData(address) {
  const origin = await geocodeAddress(address);
  const originLatLng = `${origin.lat},${origin.lng}`;
  const results = await Promise.allSettled([
    findNearestGrocery(originLatLng),
    findNearestPharmacy(originLatLng),
    findNearestHospital(originLatLng),
    findNearestUrgentCare(originLatLng),
    findNearestHighwayOnRamp(originLatLng),
    findNearestGasStation(originLatLng),
  ]);
  const [grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation] =
    results.map((r) => (r.status === 'fulfilled' ? r.value : null));
  return { address, origin, services: { grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation } };
}

function buildCompareFormHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compare Addresses — Livably</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="compare-page">
  <header class="header">
    <a href="/" style="text-decoration:none"><div class="logo">Liv<span class="logo-gold">ably</span></div></a>
  </header>
  <div class="compare-container">
    <h1 class="compare-title">Compare Addresses</h1>
    <p class="compare-intro">Compare up to 3 addresses side by side to see which location works best for you.</p>
    <form class="compare-form" id="compareForm">
      <div class="compare-input-group">
        <label class="compare-label" for="addr1">Address 1</label>
        <input class="compare-input" type="text" id="addr1" placeholder="123 Main St, City, State" required>
      </div>
      <div class="compare-input-group">
        <label class="compare-label" for="addr2">Address 2</label>
        <input class="compare-input" type="text" id="addr2" placeholder="456 Oak Ave, City, State" required>
      </div>
      <div class="compare-input-group">
        <label class="compare-label" for="addr3">Address 3 <span class="compare-optional">(optional)</span></label>
        <input class="compare-input" type="text" id="addr3" placeholder="789 Pine Rd, City, State">
      </div>
      <button class="compare-submit" type="submit">Compare Addresses</button>
    </form>
  </div>
  <script>
    document.getElementById('compareForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var addrs = [
        document.getElementById('addr1').value.trim(),
        document.getElementById('addr2').value.trim(),
        document.getElementById('addr3').value.trim(),
      ].filter(Boolean);
      window.location.href = '/compare?addresses=' + encodeURIComponent(addrs.join('|'));
    });
  </script>
</body>
</html>`;
}

function buildCompareLoadingHTML(addressesParam) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably — Comparing…</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="loading-page" data-addresses="${escapeHtml(addressesParam)}">
  <div class="loading-container">
    <div class="loading-logo">Liv<span class="logo-gold">ably</span></div>
    <div class="loading-spinner"></div>
    <p class="loading-message">Researching addresses…</p>
  </div>
  <script>
    (function () {
      var addresses = document.body.dataset.addresses;
      function reExecScripts(el) {
        el.querySelectorAll('script').forEach(function (old) {
          var s = document.createElement('script');
          for (var i = 0; i < old.attributes.length; i++) {
            s.setAttribute(old.attributes[i].name, old.attributes[i].value);
          }
          s.textContent = old.textContent;
          old.parentNode.replaceChild(s, old);
        });
      }
      fetch('/compare?addresses=' + encodeURIComponent(addresses) + '&fetch=1')
        .then(function (res) { return res.text(); })
        .then(function (html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          document.head.innerHTML = doc.head.innerHTML;
          document.body.className = doc.body.className;
          document.body.innerHTML = doc.body.innerHTML;
          reExecScripts(document.head);
          reExecScripts(document.body);
        })
        .catch(function () {
          document.querySelector('.loading-message').textContent = 'Something went wrong. Please try again.';
        });
    })();
  <\/script>
</body>
</html>`;
}

function buildCompareResultsHTML(reports) {
  const count = reports.length;

  const addrCards = reports.map((r) => {
    const { street, cityState } = parseAddressParts(r.address);
    if (r.error) {
      return `<div class="compare-addr-card compare-addr-error">
      <div class="compare-addr-street">${escapeHtml(street || r.address)}</div>
      <div class="compare-addr-city">${escapeHtml(cityState)}</div>
      <div class="compare-addr-err">Address not found</div>
    </div>`;
    }
    return `<div class="compare-addr-card">
      <div class="compare-addr-street">${escapeHtml(street)}</div>
      <div class="compare-addr-city">${escapeHtml(cityState)}</div>
    </div>`;
  }).join('');

  const serviceRows = [
    { label: 'Grocery', get: (r) => (Array.isArray(r.services?.grocery) ? r.services.grocery[0] : r.services?.grocery) },
    { label: 'Pharmacy',      get: (r) => r.services?.pharmacy },
    { label: 'Hospital',      get: (r) => r.services?.hospital },
    { label: 'Urgent Care',   get: (r) => r.services?.urgentCare },
    { label: 'Highway Access', get: (r) => r.services?.highwayRamp },
    { label: 'Gas Station',   get: (r) => r.services?.gasStation },
  ].map(({ label, get }) => {
    const times = reports.map((r) => (r.error ? null : (get(r)?.driveTimeMinutes ?? null)));
    const validTimes = times.filter((t) => t !== null);
    const minTime = validTimes.length ? Math.min(...validTimes) : null;
    const cells = times.map((time) => {
      if (time === null) return '<td class="compare-cell compare-cell-na">—</td>';
      const best = time === minTime && validTimes.length > 1;
      return `<td class="compare-cell${best ? ' compare-cell-best' : ''}">${time} min${best ? ' <span class="compare-winner">✓</span>' : ''}</td>`;
    }).join('');
    return `<tr><td class="compare-service">${escapeHtml(label)}</td>${cells}</tr>`;
  }).join('');

  const thCells = reports.map((r) => {
    const { street } = parseAddressParts(r.address);
    return `<th class="compare-th">${escapeHtml(street || r.address)}</th>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Address Comparison — Livably</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="compare-page">
  <header class="header">
    <a href="/" style="text-decoration:none"><div class="logo">Liv<span class="logo-gold">ably</span></div></a>
    <div class="report-badge">Comparison</div>
  </header>
  <div class="compare-container compare-results">
    <div class="compare-addr-row compare-cols-${count}">
      ${addrCards}
    </div>
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead>
          <tr>
            <th class="compare-th compare-th-service">Service</th>
            ${thCells}
          </tr>
        </thead>
        <tbody>
          ${serviceRows}
        </tbody>
      </table>
    </div>
    <a href="/compare" class="back-link">← Compare different addresses</a>
  </div>
</body>
</html>`;
}

app.get('/compare', async (req, res) => {
  const addressesParam = req.query.addresses;

  if (!addressesParam) {
    return res.send(buildCompareFormHTML());
  }

  const isFetch = req.query.fetch === '1';
  if (!isFetch) {
    return res.send(buildCompareLoadingHTML(addressesParam));
  }

  const addresses = addressesParam.split('|').map((a) => a.trim()).filter(Boolean).slice(0, 3);
  if (addresses.length < 2) {
    return res.send(buildErrorHTML('SERVER_ERROR', 'At least 2 addresses required', 'Please go back and enter at least 2 addresses.', null));
  }

  const reportResults = await Promise.allSettled(addresses.map((addr) => generateComparisonData(addr)));
  const reports = reportResults.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { address: addresses[i], error: r.reason?.message || 'Unknown error' },
  );

  return res.send(buildCompareResultsHTML(reports));
});

app.get('/r/:reportId', (req, res) => {
  const report = getReport(req.params.reportId);
  if (!report) {
    return res.status(404).send(buildErrorHTML('SERVER_ERROR', 'Report not found', 'This link may have expired or is invalid.', null));
  }
  try { updateReportAccess(req.params.reportId); } catch {}
  return res.redirect(`/report?address=${encodeURIComponent(report.address)}`);
});

app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/history.html'));
});

app.get('/admin/api-usage', (req, res) => {
  res.json(getUsageStats());
});

app.post('/admin/clear-cache', (req, res) => {
  geocodeCache.clear();
  placesCache.clear();
  driveTimeCache.clear();
  res.json({ success: true, message: 'All caches cleared' });
});

app.get('/admin/cache-stats', (req, res) => {
  res.json(cacheStats());
});

// ── PDF Export (FR-016) ──────────────────────────────────────────────────────

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);
}

function getDateSlug() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let activePDFs = 0;
const MAX_CONCURRENT_PDFS = 3;

app.get('/report/pdf', async (req, res) => {
  const address = req.query.address ? toTitleCase(req.query.address.trim()) : '';
  if (!address) return res.status(400).send('Address required');

  while (activePDFs >= MAX_CONCURRENT_PDFS) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  activePDFs++;

  let browser;
  try {
    // Build the internal URL for the fully-rendered report (all query params preserved, fetch=1 added)
    const params = new URLSearchParams(req.query);
    params.set('fetch', '1');
    const reportUrl = `http://localhost:${port}/report?${params.toString()}`;

    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // Block external font CDN requests — prevents large font embedding in PDF.
    // The report falls back to system fonts (Georgia / system-ui) which are print-friendly.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.emulateMediaType('print');
    await page.goto(reportUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });

    const filename = `livably-report-${slugify(address)}-${getDateSlug()}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  } catch (error) {
    console.error('[PDF] generation error:', error.message);
    res.status(500).send(buildErrorHTML('SERVER_ERROR', 'PDF generation failed', 'Unable to generate PDF. Please try again.', address));
  } finally {
    if (browser) await browser.close().catch(() => {});
    activePDFs--;
  }
});

// ────────────────────────────────────────────────────────────────────────────

ensureReportsFile();
app.listen(port, () => {
  console.log(`Livably app running at http://localhost:${port}`);
});
