const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('@googlemaps/google-maps-services-js');

const app = express();
const port = process.env.PORT || 3000;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
const googleMapsClient = new Client({});

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

async function geocodeAddress(address) {
  const geocodeResponse = await googleMapsClient.geocode({
    params: { address, key: googleMapsApiKey },
  });

  const geoResults = geocodeResponse.data.results || [];
  if (!geoResults.length) {
    throw new Error('Unable to geocode the address.');
  }

  return geoResults[0].geometry.location;
}

function isExcludedPlaceName(name, excludeTerms) {
  const normalized = (name || '').toLowerCase();
  return excludeTerms.some((term) => normalized.includes(term));
}

async function getDriveTime(originLatLng, destinationLatLng) {
  const distanceResponse = await googleMapsClient.distancematrix({
    params: {
      key: googleMapsApiKey,
      origins: [originLatLng],
      destinations: [`${destinationLatLng.lat},${destinationLatLng.lng}`],
      mode: 'driving',
      departure_time: getNextTuesday8am(),
    },
  });

  const element = distanceResponse.data.rows[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error('Unable to calculate drive time for the destination.');
  }

  return Math.round((element.duration_in_traffic?.value ?? element.duration?.value) / 60);
}

// Returns top 3 nearest grocery stores by drive time.
// Uses textSearch with tight radius so Google relevance is overridden by actual drive time.
// Excludes gas stations, convenience stores, and dollar stores by place type.
async function findNearestGrocery(originLatLng) {
  const placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'grocery store',
      location: originLatLng,
      radius: 8000,
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
      } catch {
        return null;
      }
    }),
  );

  const valid = withDriveTimes.filter(Boolean);
  valid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);
  return valid.slice(0, 3);
}

async function findNearestPharmacy(originLatLng) {
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

  return {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
}

// Gets top 5 hospital results, calculates actual drive time to each,
// and returns the one with the shortest drive time — not just Google's first result.
async function findNearestHospital(originLatLng) {
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
      } catch {
        return null;
      }
    }),
  );

  const valid = withDriveTimes.filter(Boolean);
  if (!valid.length) {
    throw new Error('Unable to calculate drive times to nearby hospitals.');
  }

  valid.sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);
  return valid[0];
}

// Excludes retail health clinics (Little Clinic, MinuteClinic) that are not true urgent care.
async function findNearestUrgentCare(originLatLng) {
  const retailClinicExclusions = ['little clinic', 'minuteclinic', 'minute clinic', 'cvs health', 'walgreens health'];

  let placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      keyword: 'urgent care',
    },
  });

  let placeResults = (placesResponse.data.results || []).filter(
    (place) => !isExcludedPlaceName(place.name, retailClinicExclusions),
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
      (place) => !isExcludedPlaceName(place.name, retailClinicExclusions),
    );
  }

  const place = placeResults[0];
  if (!place) {
    throw new Error('No urgent care clinic found near that address.');
  }

  return {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
}

// Finds nearby interstates by geocoding each highway name near the address city/state.
// Validates the returned result actually mentions the highway to filter out false matches.
// Shows the closest as primary, lists others within 20 minutes in the note.
async function findNearestHighwayOnRamp(originLatLng) {
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
    'I-75', 'I-64', 'I-65', 'I-71', 'I-70', 'I-40', 'I-80', 'I-90',
    'I-95', 'I-85', 'I-10', 'I-20', 'I-25', 'I-35', 'I-55', 'I-57',
    'I-77', 'I-78', 'I-81', 'I-83', 'I-87', 'I-93', 'I-94', 'I-96',
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

  return {
    name: primary.highway,
    address: primary.address,
    location: primary.location,
    driveTimeMinutes: primary.driveTimeMinutes,
    note: othersNote,
  };
}

// Returns nearest school by distance.
// Note: nearest by distance is not the assigned school for the parcel.
// Assigned school requires verification with the school district.
async function findNearestSchool(originLatLng) {
  let placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'school',
    },
  });

  let placeResults = placesResponse.data.results || [];

  if (!placeResults.length) {
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

  const place = placeResults[0];
  if (!place) {
    throw new Error('No school found near that address.');
  }

  return {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
    note: 'This is the nearest school by distance. Assigned school for this address requires verification directly with the school district.',
  };
}

async function findNearestGasStation(originLatLng) {
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
  return {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
}

async function findNearestPark(originLatLng) {
  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'park',
    },
  });
  const place = (placesResponse.data.results || [])[0];
  if (!place) throw new Error('No park found near that address.');
  return {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
}

async function findNearestCoffeeShop(originLatLng) {
  const exclusions = ['sheetz', 'circle k', '7-eleven', '7 eleven', 'speedway', 'wawa', 'pilot', 'love\'s'];
  const placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'coffee shop',
      location: originLatLng,
      radius: 15000,
    },
  });
  const place = (placesResponse.data.results || []).filter(
    (p) => !isExcludedPlaceName(p.name, exclusions),
  )[0];
  if (!place) throw new Error('No coffee shop found near that address.');
  return {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
}

async function findNearestElementarySchool(originLatLng) {
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
  return {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
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
    return `<div class="dest-section">${label}<p class="dest-note">Not available.</p></div>`;
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
    return `<div class="dest-section">${labelHTML}<p class="dest-note">Not available.</p></div>`;
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
    return `<div class="dest-section">${label}<p class="dest-note">Not available.</p></div>`;
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
  const times = [g, pharmacy, gasStation].filter(Boolean).map((s) => s.driveTimeMinutes);
  if (!times.length) return null;
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

  let opening;
  if (avg < 10) opening = 'Everything you need is right around the corner.';
  else if (avg < 20) opening = 'A quick drive gets you to daily essentials.';
  else if (avg < 30) opening = "Stock up when you're out—errands take a bit longer from here.";
  else opening = "You'll want to plan your trips. Essential services are farther out.";

  const parts = [];
  if (g) parts.push(`Your nearest grocery store (${g.name}) is ${g.driveTimeMinutes} minutes away.`);
  if (pharmacy) parts.push(`Pharmacy runs take about ${pharmacy.driveTimeMinutes} minutes.`);
  if (gasStation) parts.push(`The nearest gas station is ${gasStation.driveTimeMinutes} minutes.`);

  const items = [
    g ? { label: 'Grocery', name: g.name, time: g.driveTimeMinutes } : null,
    pharmacy ? { label: 'Pharmacy', name: pharmacy.name, time: pharmacy.driveTimeMinutes } : null,
    gasStation ? { label: 'Gas', name: gasStation.name, time: gasStation.driveTimeMinutes } : null,
  ].filter(Boolean);

  return { opening, details: parts.join(' '), items };
}

function generatePeaceOfMindNarrative(hospital, urgentCare) {
  if (!hospital) return null;

  let opening;
  if (hospital.driveTimeMinutes < 15) opening = 'Medical care is close by.';
  else if (hospital.driveTimeMinutes < 25) opening = `The nearest hospital is ${hospital.driveTimeMinutes} minutes away—worth knowing for emergencies.`;
  else opening = 'Hospital access takes time from here.';

  let details = `${hospital.name} is ${hospital.driveTimeMinutes} minutes away.`;
  if (urgentCare && urgentCare.driveTimeMinutes < hospital.driveTimeMinutes - 5) {
    details += ` For non-emergencies, ${urgentCare.name} is closer at ${urgentCare.driveTimeMinutes} minutes.`;
  }

  const items = [
    { label: 'Hospital', name: hospital.name, time: hospital.driveTimeMinutes },
    urgentCare ? { label: 'Urgent Care', name: urgentCare.name, time: urgentCare.driveTimeMinutes } : null,
  ].filter(Boolean);

  return { opening, details, items };
}

function generateGettingAroundNarrative(highwayRamp) {
  if (!highwayRamp) return null;

  let opening;
  if (highwayRamp.driveTimeMinutes < 5) opening = 'Quick highway access for commuting.';
  else if (highwayRamp.driveTimeMinutes < 15) opening = `The highway is ${highwayRamp.driveTimeMinutes} minutes away.`;
  else opening = `You're off the beaten path—highway access is ${highwayRamp.driveTimeMinutes} minutes.`;

  return {
    opening,
    details: `${highwayRamp.name} is ${highwayRamp.driveTimeMinutes} minutes from here.`,
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
      <p class="insight-details">${escapeHtml(narrative.details)}</p>
      <div class="insight-breakdown">
        ${buildInsightItemsHTML(narrative.items)}
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
      <p class="insights-intro">The stuff you'd only learn after living here for two years.</p>
      ${sectionsHTML}${calloutsHTML}
    </div>
  </div>`;
}

function buildAdditionalServicesCardHTML(elementarySchool, park, coffeeShop) {
  if (!elementarySchool && !park && !coffeeShop) return '';
  return `
  <div class="chapter-card">
    <div class="chapter-header">
      <div class="chapter-label">Additional Places</div>
      <div class="chapter-title">More Nearby Destinations</div>
    </div>
    <div class="chapter-body">
      ${buildDestSection('Elementary School', elementarySchool)}
      ${buildDestSection('Park', park)}
      ${buildDestSection('Coffee Shop', coffeeShop)}
    </div>
  </div>`;
}

function buildReportHTML(address, { grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool, origin, reportId }) {
  const { street, cityState } = parseAddressParts(address);
  const researchDate = formatResearchDate();

  const shareSectionHTML = reportId ? `
  <div class="share-section">
    <button id="shareBtn" class="share-button">Share this report</button>
    <span id="shareToast" class="share-toast hidden">Link copied!</span>
  </div>
  <script>
    (function () {
      var id = '${reportId}';
      document.getElementById('shareBtn').addEventListener('click', function () {
        var url = window.location.origin + '/r/' + id;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(showToast).catch(function () { prompt('Copy this link:', url); });
        } else {
          prompt('Copy this link:', url);
        }
      });
      function showToast() {
        var t = document.getElementById('shareToast');
        t.classList.remove('hidden');
        setTimeout(function () { t.classList.add('hidden'); }, 3000);
      }
    })();
  <\/script>` : '';

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
    grocery.forEach((s, i) => {
      if (s?.location) mapServices.push({
        name: s.name, address: s.address, driveTimeMinutes: s.driveTimeMinutes,
        lat: s.location.lat, lng: s.location.lng,
        label: i === 0 ? 'Grocery' : null,
      });
    });
  }
  [
    { result: pharmacy,         label: 'Pharmacy' },
    { result: hospital,         label: 'Hospital' },
    { result: urgentCare,       label: 'Urgent Care' },
    { result: highwayRamp,      label: highwayRamp?.name || 'Highway' },
    { result: school,           label: 'School' },
    { result: gasStation,       label: 'Gas Station' },
    { result: park,             label: 'Park' },
    { result: coffeeShop,       label: 'Coffee Shop' },
    { result: elementarySchool, label: 'Elementary School' },
  ].forEach(({ result, label }) => {
    if (result?.location) mapServices.push({
      name: result.name, address: result.address, driveTimeMinutes: result.driveTimeMinutes,
      lat: result.location.lat, lng: result.location.lng, label,
    });
  });

  const insightsCardHTML = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
  const additionalServicesCardHTML = buildAdditionalServicesCardHTML(elementarySchool, park, coffeeShop);

  const mapData = origin ? { home: { lat: origin.lat, lng: origin.lng }, services: mapServices } : null;
  // Escape < so address/name strings can't contain </script> and break the JSON block
  const safeMapJSON = mapData ? JSON.stringify(mapData).replace(/</g, '\\u003c') : null;

  const mapSectionHTML = mapData ? `
  <div class="map-section">
    <div id="map" class="report-map"></div>
  </div>` : '';

  const mapScriptsHTML = mapData ? `
  <script id="map-data" type="application/json">${safeMapJSON}<\/script>
  <script>
    window.initMap = function () {
      try {
        var data = JSON.parse(document.getElementById('map-data').textContent);
        var home = { lat: data.home.lat, lng: data.home.lng };
        var map = new google.maps.Map(document.getElementById('map'), {
          center: home, zoom: 12,
          mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        });
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(home);
        new google.maps.Marker({
          position: home, map: map, title: 'Your address', zIndex: 10,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#b8922a', fillOpacity: 1,
            strokeColor: '#ffffff', strokeWeight: 2, scale: 10,
          },
        });
        var infoWindow = new google.maps.InfoWindow();
        data.services.forEach(function (svc) {
          var pos = { lat: svc.lat, lng: svc.lng };
          bounds.extend(pos);
          var marker = new google.maps.Marker({ position: pos, map: map, title: svc.name });
          marker.addListener('click', function () {
            infoWindow.setContent(
              '<div style="font-family:DM Sans,sans-serif;font-size:0.85rem;max-width:200px">' +
              '<strong>' + svc.name + '</strong>' +
              (svc.label ? '<br><span style="color:#6b6b6b;font-size:0.75rem">' + svc.label + '</span>' : '') +
              '<br><span style="color:#6b6b6b">' + svc.address + '</span>' +
              '<br><strong>' + svc.driveTimeMinutes + ' min</strong></div>'
            );
            infoWindow.open(map, marker);
          });
        });
        map.fitBounds(bounds);
        var listener = google.maps.event.addListener(map, 'idle', function () {
          if (map.getZoom() > 15) map.setZoom(15);
          google.maps.event.removeListener(listener);
        });
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
<body>
  <header class="header">
    <div class="logo">Liv<span class="logo-gold">ably</span></div>
    <div class="report-badge">Standard Report</div>
  </header>
  <div class="hero">
    <div class="hero-street">${escapeHtml(street)}</div>
    <div class="hero-city">${escapeHtml(cityState)}</div>
    <div class="hero-date">Research date: ${researchDate}</div>${shareSectionHTML}
  </div>${mapSectionHTML}${insightsCardHTML}
  <div class="chapter-card">
    <div class="chapter-header">
      <div class="chapter-label">Chapter 03</div>
      <div class="chapter-title">Daily Reachability</div>
    </div>
    <div class="chapter-body">
      ${sectionsHTML}
    </div>
  </div>${additionalServicesCardHTML}
  <footer class="footer">
    <div class="footer-brand">Liv<span class="logo-gold">ably</span></div>
    <div class="footer-meta">${researchDate} · ${escapeHtml(address)}</div>
    <div class="footer-legal">Drive times are estimates from Google Maps for 8am Tuesday departure. Assigned school requires verification with the local school district. For informational purposes only.</div>
    <a href="/" class="back-link">← Back to address form</a>
  </footer>${mapScriptsHTML}
</body>
</html>`;
}

function classifyError(error) {
  const msg = (error.message || '').toLowerCase();
  const status = error.response?.status;
  if (msg.includes('unable to geocode')) {
    return { type: 'ADDRESS_NOT_FOUND', title: "We couldn't find that address", message: 'Check the spelling and try again.' };
  }
  if (status === 429 || msg.includes('quota') || msg.includes('rate limit')) {
    return { type: 'RATE_LIMIT', title: 'High demand right now', message: 'Please try again in a moment.' };
  }
  return { type: 'SERVER_ERROR', title: 'Something went wrong', message: 'An error occurred generating your report.' };
}

function buildErrorHTML(type, title, message, address) {
  const tryAgainLink = address
    ? `\n    <a href="/?address=${encodeURIComponent(address)}" class="btn-retry">Try again</a>`
    : '';
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
    <div class="error-icon">⚠️</div>
    <h1 class="error-title">${escapeHtml(title)}</h1>
    <p class="error-message">${escapeHtml(message)}</p>${tryAgainLink}
    <a href="/" class="back-link">Try a different address</a>
  </div>
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
        fetch('/report?address=' + encodeURIComponent(address) + '&fetch=1')
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
              msgEl.innerHTML = 'Connection issue. <a href="/report?address=' + encodeURIComponent(address) + '">Try again</a>';
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
  const address = req.query.address;
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

  try {
    const origin = await geocodeAddress(address);
    const originLatLng = `${origin.lat},${origin.lng}`;

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

    let reportId = null;
    try { reportId = saveReport(address); } catch {}

    return res.send(buildReportHTML(address, { grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool, origin, reportId }));
  } catch (error) {
    const { type, title, message } = classifyError(error);
    return res.send(buildErrorHTML(type, title, message, address));
  }
});

app.get('/r/:reportId', (req, res) => {
  const report = getReport(req.params.reportId);
  if (!report) {
    return res.status(404).send(buildErrorHTML('SERVER_ERROR', 'Report not found', 'This link may have expired or is invalid.', null));
  }
  try { updateReportAccess(req.params.reportId); } catch {}
  return res.redirect(`/report?address=${encodeURIComponent(report.address)}`);
});

ensureReportsFile();
app.listen(port, () => {
  console.log(`Livably app running at http://localhost:${port}`);
});
