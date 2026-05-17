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

function parseHighwayRampInfo(place) {
  const text = `${place.name || ''} ${place.formatted_address || ''} ${place.vicinity || ''}`.toUpperCase();
  const interstateMatch = text.match(/\b(I-[0-9]+|US-[0-9]+|SR[0-9]+|STATE ROUTE [0-9]+)\b/);
  const directionMatch = text.match(/\b(NORTH|SOUTH|EAST|WEST|NB|SB|EB|WB)\b/);

  const interstate = interstateMatch ? interstateMatch[1].replace('STATE ROUTE ', 'SR') : '';
  let direction = directionMatch ? directionMatch[1] : '';
  if (direction === 'NB') direction = 'North';
  if (direction === 'SB') direction = 'South';
  if (direction === 'EB') direction = 'East';
  if (direction === 'WB') direction = 'West';

  if (interstate) {
    return `${interstate}${direction ? ` ${direction}` : ''}`;
  }

  return null;
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

async function findNearestGrocery(originLatLng) {
  const groceryExclusions = [
    'dollar',
    'gas station',
    'convenience store',
    'sheetz',
    'circle k',
    '7-eleven',
    'family dollar',
    'dollar general',
    'dollar tree',
  ];

  let placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'full-service grocery store',
      location: originLatLng,
      radius: 25000,
    },
  });

  let placeResults = (placesResponse.data.results || []).filter(
    (place) => !isExcludedPlaceName(place.name, groceryExclusions),
  );

  if (!placeResults.length) {
    placesResponse = await googleMapsClient.textSearch({
      params: {
        key: googleMapsApiKey,
        query: 'grocery store',
        location: originLatLng,
        radius: 25000,
      },
    });
    placeResults = (placesResponse.data.results || []).filter(
      (place) => !isExcludedPlaceName(place.name, groceryExclusions),
    );
  }

  if (!placeResults.length) {
    throw new Error('No full-service grocery store found near that address.');
  }

  const bestStore = placeResults[0];
  return {
    name: bestStore.name,
    address: bestStore.formatted_address || bestStore.vicinity || bestStore.name,
    location: bestStore.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, bestStore.geometry.location),
  };
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

  const place = placeResults[0];
  if (!place) {
    throw new Error('No hospital found near that address.');
  }

  return {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
}

async function findNearestUrgentCare(originLatLng) {
  let placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'urgent care clinic',
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
        keyword: 'urgent care',
      },
    });
    placeResults = placesResponse.data.results || [];
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

async function findNearestHighwayOnRamp(originLatLng) {
  let placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'highway on ramp',
      location: originLatLng,
      radius: 50000,
    },
  });

  let placeResults = placesResponse.data.results || [];
  if (!placeResults.length) {
    placesResponse = await googleMapsClient.textSearch({
      params: {
        key: googleMapsApiKey,
        query: 'interstate on ramp',
        location: originLatLng,
        radius: 50000,
      },
    });
    placeResults = placesResponse.data.results || [];
  }

  const place = placeResults[0];
  if (!place) {
    throw new Error('No highway on-ramp found near that address.');
  }

  const rampNote = parseHighwayRampInfo(place);
  return {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
    note: rampNote ? `Interstate and direction: ${rampNote}` : null,
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
  if (!place) {
    throw new Error('No gas station found near that address.');
  }

  return {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
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
  ${result.note ? `<p>${result.note}</p>` : ''}
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
      gasStation,
    ] = await Promise.all([
      findNearestGrocery(originLatLng),
      findNearestPharmacy(originLatLng),
      findNearestHospital(originLatLng),
      findNearestUrgentCare(originLatLng),
      findNearestHighwayOnRamp(originLatLng),
      findNearestGasStation(originLatLng),
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
  ${renderDestinationSection('1. Nearest full-service grocery (fresh produce, meat, dairy)', grocery)}
  ${renderDestinationSection('2. Nearest pharmacy', pharmacy)}
  ${renderDestinationSection('3. Nearest hospital with a full emergency department', hospital)}
  ${renderDestinationSection('4. Nearest urgent care clinic', urgentCare)}
  ${renderDestinationSection('5. Nearest highway on-ramp', highwayRamp)}
  ${renderDestinationSection('6. Nearest gas station', gasStation)}
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
