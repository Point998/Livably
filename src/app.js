const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const path = require('path');
const { Client } = require('@googlemaps/google-maps-services-js');

const app = express();
const port = process.env.PORT || 3000;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
const googleMapsClient = new Client({});

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

  const nearby = withDriveTimes
    .filter(Boolean)
    .filter((r) => r.driveTimeMinutes <= 20)
    .sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes);

  const candidates = nearby.length
    ? nearby
    : withDriveTimes.filter(Boolean).sort((a, b) => a.driveTimeMinutes - b.driveTimeMinutes).slice(0, 1);

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

function renderGrocerySection(stores) {
  if (!stores || !stores.length) {
    return `<section><h2>1. Nearest grocery stores</h2><p>Not available.</p></section>`;
  }

  const rows = stores.map((s) => `
  <p><strong>${s.name}</strong><br>${s.address}<br>${s.driveTimeMinutes} minutes</p>
  `).join('<hr style="border:none;border-top:1px solid #eee;margin:8px 0;">');

  return `<section>
  <h2>1. Nearest grocery stores</h2>
  ${rows}
</section>`;
}

function renderDestinationSection(title, result) {
  if (!result) {
    return `<section><h2>${title}</h2><p>Not available.</p></section>`;
  }

  return `<section>
  <h2>${title}</h2>
  <p><strong>${result.name}</strong></p>
  <p>${result.address}</p>
  <p>${result.driveTimeMinutes} minutes</p>
  ${result.note ? `<p><em>${result.note}</em></p>` : ''}
</section>`;
}

app.get('/report', async (req, res) => {
  const address = req.query.address;

  if (!address) {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably Report</title>
</head>
<body style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 640px; margin: auto;">
  <h1>Livably Report</h1>
  <p>No address provided.</p>
  <p><a href="/">Back to address form</a></p>
</body>
</html>`);
  }

  if (!googleMapsApiKey) {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably Report</title>
</head>
<body style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 640px; margin: auto;">
  <h1>Livably Report</h1>
  <p>Missing GOOGLE_MAPS_API_KEY in .env.</p>
  <p><a href="/">Back to address form</a></p>
</body>
</html>`);
  }

  try {
    const origin = await geocodeAddress(address);
    const originLatLng = `${origin.lat},${origin.lng}`;

    const [
      grocery,
      pharmacy,
      hospital,
      urgentCare,
      highwayRamp,
      school,
    ] = await Promise.all([
      findNearestGrocery(originLatLng),
      findNearestPharmacy(originLatLng),
      findNearestHospital(originLatLng),
      findNearestUrgentCare(originLatLng),
      findNearestHighwayOnRamp(originLatLng),
      findNearestSchool(originLatLng),
    ]);

    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably Daily Reachability Report</title>
</head>
<body style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 640px; margin: auto;">
  <h1>Livably Daily Reachability Report</h1>
  <p>Drive times are door-to-door for 8am Tuesday departure.</p>
  ${renderGrocerySection(grocery)}
  ${renderDestinationSection('2. Nearest pharmacy', pharmacy)}
  ${renderDestinationSection('3. Nearest hospital with a full emergency department', hospital)}
  ${renderDestinationSection('4. Nearest urgent care clinic', urgentCare)}
  ${renderDestinationSection('5. Nearest highway access', highwayRamp)}
  ${renderDestinationSection('6. Nearest school', school)}
  <p><a href="/">Back to address form</a></p>
</body>
</html>`);
  } catch (error) {
    const message = error?.response?.data?.error_message || error.message || 'An error occurred while building the daily reachability report.';
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably Report</title>
</head>
<body style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 640px; margin: auto;">
  <h1>Livably Report</h1>
  <p>${message}</p>
  <p><a href="/">Back to address form</a></p>
</body>
</html>`);
  }
});

app.listen(port, () => {
  console.log(`Livably app running at http://localhost:${port}`);
});
