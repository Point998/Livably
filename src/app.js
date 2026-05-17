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

const REPORT_STYLES = `
  :root {
    --ink: #1a1a1a;
    --cream: #faf8f4;
    --gold: #b8922a;
    --white: #ffffff;
    --muted: #6b6b6b;
    --divider: #e8e4de;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: var(--cream);
    color: var(--ink);
    max-width: 480px;
    margin: 0 auto;
  }
  .header {
    background: var(--ink);
    padding: 1.25rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .logo {
    font-family: 'Fraunces', serif;
    font-size: 1.5rem;
    color: var(--white);
    letter-spacing: -0.02em;
  }
  .logo-gold { color: var(--gold); }
  .report-badge {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    border: 1px solid rgba(255,255,255,0.15);
    padding: 0.3rem 0.65rem;
    border-radius: 4px;
  }
  .hero {
    padding: 2rem 1.5rem 1.25rem;
  }
  .hero-street {
    font-family: 'Fraunces', serif;
    font-size: 1.65rem;
    line-height: 1.2;
    font-weight: 600;
  }
  .hero-city {
    margin-top: 0.4rem;
    font-size: 0.95rem;
    color: var(--muted);
  }
  .hero-date {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: var(--muted);
    letter-spacing: 0.03em;
  }
  .chapter-card {
    background: var(--white);
    margin: 0.5rem 1rem 1rem;
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    overflow: hidden;
  }
  .chapter-header {
    padding: 1.1rem 1.25rem;
    border-bottom: 1px solid var(--divider);
    border-left: 3px solid var(--gold);
  }
  .chapter-label {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .chapter-title {
    font-family: 'Fraunces', serif;
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: 0.2rem;
  }
  .chapter-body { padding: 0 1.25rem; }
  .dest-section {
    padding: 1.1rem 0;
    border-bottom: 1px solid var(--divider);
  }
  .dest-section:last-child { border-bottom: none; }
  .dest-label {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.6rem;
  }
  .grocery-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.6rem 0;
  }
  .grocery-item + .grocery-item { border-top: 1px solid var(--divider); }
  .dest-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .dest-name {
    font-weight: 600;
    font-size: 0.9rem;
  }
  .dest-address {
    font-size: 0.78rem;
    color: var(--muted);
    margin-top: 0.15rem;
  }
  .drive-time {
    font-weight: 600;
    font-size: 0.9rem;
    white-space: nowrap;
    margin-left: 0.75rem;
    flex-shrink: 0;
  }
  .dest-note {
    font-size: 0.78rem;
    color: var(--muted);
    font-style: italic;
    margin-top: 0.5rem;
    line-height: 1.5;
  }
  .bucket-tag {
    display: inline-block;
    font-size: 0.6rem;
    font-weight: 600;
    font-style: normal;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
    border: 1px solid var(--gold);
    padding: 0.15rem 0.45rem;
    border-radius: 3px;
    margin-right: 0.35rem;
    vertical-align: middle;
  }
  .simple-message {
    font-size: 0.9rem;
    color: var(--muted);
    margin-top: 1rem;
  }
  .footer {
    padding: 2rem 1.5rem;
    text-align: center;
    border-top: 1px solid var(--divider);
    margin-top: 0.5rem;
  }
  .footer-brand {
    font-family: 'Fraunces', serif;
    font-size: 1rem;
  }
  .footer-meta {
    font-size: 0.72rem;
    color: var(--muted);
    margin-top: 0.5rem;
    line-height: 1.5;
  }
  .footer-legal {
    font-size: 0.68rem;
    color: var(--muted);
    margin-top: 0.75rem;
    line-height: 1.6;
  }
  .back-link {
    display: inline-block;
    margin-top: 1.25rem;
    font-size: 0.8rem;
    color: var(--muted);
    text-decoration: none;
  }
  .back-link:hover { color: var(--ink); }
`;

const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">`;

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

function buildReportHTML(address, { grocery, pharmacy, hospital, urgentCare, highwayRamp, school }) {
  const { street, cityState } = parseAddressParts(address);
  const researchDate = formatResearchDate();

  const sectionsHTML = [
    buildGrocerySection(grocery),
    buildDestSection('Pharmacy', pharmacy),
    buildDestSection('Hospital — Full Emergency Department', hospital),
    buildDestSection('Urgent Care', urgentCare),
    buildDestSection('Highway Access', highwayRamp),
    buildSchoolSection(school),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably Report — ${escapeHtml(address)}</title>${FONT_LINKS}
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <header class="header">
    <div class="logo">Liv<span class="logo-gold">ably</span></div>
    <div class="report-badge">Standard Report</div>
  </header>
  <div class="hero">
    <div class="hero-street">${escapeHtml(street)}</div>
    <div class="hero-city">${escapeHtml(cityState)}</div>
    <div class="hero-date">Research date: ${researchDate}</div>
  </div>
  <div class="chapter-card">
    <div class="chapter-header">
      <div class="chapter-label">Chapter 03</div>
      <div class="chapter-title">Daily Reachability</div>
    </div>
    <div class="chapter-body">
      ${sectionsHTML}
    </div>
  </div>
  <footer class="footer">
    <div class="footer-brand">Liv<span class="logo-gold">ably</span></div>
    <div class="footer-meta">${researchDate} · ${escapeHtml(address)}</div>
    <div class="footer-legal">Drive times are estimates from Google Maps for 8am Tuesday departure. Assigned school requires verification with the local school district. For informational purposes only.</div>
    <a href="/" class="back-link">← Back to address form</a>
  </footer>
</body>
</html>`;
}

function buildSimpleHTML(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably</title>${FONT_LINKS}
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <header class="header">
    <div class="logo">Liv<span class="logo-gold">ably</span></div>
  </header>
  <div class="hero">
    <p class="simple-message">${escapeHtml(message)}</p>
  </div>
  <footer class="footer">
    <a href="/" class="back-link">← Back to address form</a>
  </footer>
</body>
</html>`;
}

app.get('/report', async (req, res) => {
  const address = req.query.address;

  if (!address) {
    return res.send(buildSimpleHTML('No address provided.'));
  }

  if (!googleMapsApiKey) {
    return res.send(buildSimpleHTML('Missing GOOGLE_MAPS_API_KEY in .env.'));
  }

  try {
    const origin = await geocodeAddress(address);
    const originLatLng = `${origin.lat},${origin.lng}`;

    const [grocery, pharmacy, hospital, urgentCare, highwayRamp, school] = await Promise.all([
      findNearestGrocery(originLatLng),
      findNearestPharmacy(originLatLng),
      findNearestHospital(originLatLng),
      findNearestUrgentCare(originLatLng),
      findNearestHighwayOnRamp(originLatLng),
      findNearestSchool(originLatLng),
    ]);

    return res.send(buildReportHTML(address, { grocery, pharmacy, hospital, urgentCare, highwayRamp, school }));
  } catch (error) {
    const message = error?.response?.data?.error_message || error.message || 'An error occurred while building the report.';
    return res.send(buildSimpleHTML(message));
  }
});

app.listen(port, () => {
  console.log(`Livably app running at http://localhost:${port}`);
});
