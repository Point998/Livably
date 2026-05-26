const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { geocodeCache, placesCache, driveTimeCache, cacheStats } = require('./cache');
const { QuotaExceededError, RateLimitError, getUsageStats } = require('./rateLimit');
const { getPremiumData, buildPremiumSectionsHTML } = require('./premium');
const { logRequest, logError, logAnalysis, readRecentLogs } = require('./logger');
const { getMitigation, loadMitigations } = require('./errorMemory');

const { geocodeAddress } = require('./shared/google/geocoding');
const { reverseGeocodeAddress } = require('./shared/google/reverseGeocode');
const { getDriveTime, getTrafficVariations } = require('./shared/google/distanceMatrix');
const { googleMapsClient, googleMapsApiKey } = require('./shared/google/client');
const { findNearestGrocery, findNearestPharmacy, findNearestGasStation } = require('./modules/reachability/data');
const { findNearestHighwayOnRamp } = require('./modules/access/data');
const { findNearestHospital, findNearestUrgentCare } = require('./modules/health/data');
const { findNearestSchool, findNearestElementarySchool } = require('./modules/schools/data');
const { findNearestPark, findNearestCoffeeShop } = require('./modules/recreation/data');
const {
  escapeHtml, formatDriveTime, toTitleCase,
  parseAddressParts, formatResearchDate, slugify, getDateSlug,
} = require('./utils/text');
const {
  GROCERY_SEARCH_RADIUS_M, GROCERY_CANDIDATE_COUNT, GROCERY_EXCLUDED_TYPES,
  HOSPITAL_SEARCH_RADIUS_M, HOSPITAL_CANDIDATE_COUNT,
  COFFEE_SHOP_CANDIDATE_COUNT,
  ELEMENTARY_SCHOOL_SEARCH_RADIUS_M, ELEMENTARY_SCHOOL_EXCLUSIONS,
  HIGHWAY_MAX_DRIVE_MINUTES, HIGHWAY_INTERCHANGE_MAX_MINUTES,
  INTERSTATE_LIST,
  MAX_CONCURRENT_PDFS,
  PARK_EXCLUDED_TYPES, PARK_LEISURE_TYPES,
  SCHOOL_PLACE_TYPES, SCHOOL_NAME_TERMS,
  CUSTOM_DEST_ICONS, ERROR_ICONS,
} = require('./utils/constants');

const app = express();
const port = process.env.PORT || 3000;

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
      <div class="bucket-check"><div class="bucket-label">Things to Check</div><div class="bucket-text">${escapeHtml(disclaimer)}</div></div>
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

function buildHeroInsightRowsHTML(hospital, school, highwayRamp, premium) {
  const findings = [];
  const env = premium?.environment;

  const flood = env?.floodRisk;
  if (flood) {
    if (flood.risk === 'High' || flood.risk === 'Very High') {
      findings.push({ bucket: 'Things to Check', cls: 'check',
        text: `FEMA Flood Zone ${flood.zone} — flood insurance required, adds $1,500–$4,000/year.` });
    } else if (flood.zone === 'X') {
      findings.push({ bucket: 'Cool Things to Know', cls: 'cool',
        text: `Outside FEMA high-risk flood zones (Zone X) — flood insurance not federally required.` });
    } else {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `FEMA Flood Zone ${flood.zone} — moderate risk area, worth pricing flood insurance before closing.` });
    }
  }

  if (school) {
    findings.push({ bucket: 'Things to Check', cls: 'check',
      text: `Nearest school: ${school.name} (${school.driveTimeMinutes} min). Assigned school requires district verification.` });
  }

  if (hospital) {
    if (hospital.driveTimeMinutes > 20) {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `Nearest ER (${hospital.name}) is ${hospital.driveTimeMinutes} min away — farther than average.` });
    } else if (hospital.driveTimeMinutes <= 10) {
      findings.push({ bucket: 'Cool Things to Know', cls: 'cool',
        text: `${hospital.name} is ${hospital.driveTimeMinutes} min away — full emergency department within quick reach.` });
    } else {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `Nearest ER (${hospital.name}) is ${hospital.driveTimeMinutes} min — know your route before you need it.` });
    }
  }

  if (highwayRamp) {
    if (highwayRamp.driveTimeMinutes <= 8) {
      findings.push({ bucket: 'Cool Things to Know', cls: 'cool',
        text: `${highwayRamp.name} is ${highwayRamp.driveTimeMinutes} min away — quick highway access.` });
    } else if (highwayRamp.driveTimeMinutes > HIGHWAY_MAX_DRIVE_MINUTES) {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `${highwayRamp.name} is ${highwayRamp.driveTimeMinutes} min — regional travel adds meaningful time.` });
    }
  }

  const radon = env?.radon;
  if (radon && radon.zone === 1) {
    findings.push({ bucket: 'Things to Check', cls: 'check',
      text: `EPA Radon Zone 1 (high potential) — a $15–$30 test before closing is strongly recommended.` });
  }

  if (!findings.length) return '';
  const top = findings.slice(0, 4);

  const ICONS = {
    cool: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2L8 2a6 6 0 100 12 6 6 0 000-12z" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11" r="0.75" fill="currentColor"/></svg>`,
    consider: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="5" r="0.75" fill="currentColor"/></svg>`,
  };

  return `
    <div class="hero-insights-label">At a Glance</div>
    ${top.map((f) => `
    <div class="hero-insight-row ki-${f.cls}">
      <div class="hero-insight-icon">${ICONS[f.cls]}</div>
      <div class="hero-insight-right">
        <span class="hero-insight-bucket">${escapeHtml(f.bucket)}</span>
        <p class="hero-insight-text">${escapeHtml(f.text)}</p>
      </div>
    </div>`).join('')}`;
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
    const badgeClass = category.color === 'green'  ? 'badge-response-green'
                     : category.color === 'gold'   ? 'badge-response-gold'
                     : category.color === 'orange' ? 'badge-response-orange'
                     :                               'badge-response-red';
    return `
      <div class="ch01-station-row">
        <span class="ch01-station-icon">${icon}</span>
        <div class="ch01-station-info">
          <span class="ch01-station-name">${escapeHtml(station.name)}</span>
          <span class="ch01-station-dist">${station.distanceMiles} mi</span>
        </div>
        <span class="ch01-response-badge ${badgeClass}">~${estimate} min · ${escapeHtml(category.label)}</span>
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

  const erSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:96" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" style="--path-len:96"/></svg>`;

  return `
  <section class="chapter" data-ch="health">
    <div class="chapter-inner">
      <div class="chapter-num" aria-hidden="true">01</div>
      <header class="chapter-hd">
        <div class="chapter-eyebrow">
          <span class="chapter-icon">${erSvg}</span>
          Health &amp; Safety
        </div>
        <h2 class="chapter-title">When it matters most, proximity is everything.</h2>
      </header>
      <p class="chapter-intro">Emergency access shapes real outcomes. These are the numbers that matter most if something goes wrong.</p>
      <div class="chapter-body">
        <div class="chapter-left">
          ${erHTML}
          ${checksHTML ? `<div class="ch01-checks"><div class="ch01-checks-label">Things to Check Before You Close</div>${checksHTML}</div>` : ''}
          <div class="key-takeaway">
            <span class="kt-icon">🔑</span>
            <div class="kt-body"><strong>Key Takeaway:</strong> ${escapeHtml(takeaway)}</div>
          </div>
          <p class="ch01-disclaimer">Response times are estimates based on station distance and typical dispatch speeds. Actual times vary by call volume and unit availability. Research date: ${today}.</p>
        </div>
        <div class="chapter-right">
          ${stationsHTML ? `<div class="snapshot-card"><div class="snapshot-card-label">Emergency Response</div><div class="ch01-stations">${stationsHTML}</div></div>` : ''}
        </div>
      </div>
    </div>
  </section>
  <div class="chapter-rule"></div>`;
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

  const sunSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:120" aria-hidden="true"><circle cx="12" cy="12" r="5" style="--path-len:32"/><line x1="12" y1="1" x2="12" y2="3" style="--path-len:16"/><line x1="12" y1="21" x2="12" y2="23" style="--path-len:16"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" style="--path-len:12"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" style="--path-len:12"/><line x1="1" y1="12" x2="3" y2="12" style="--path-len:16"/><line x1="21" y1="12" x2="23" y2="12" style="--path-len:16"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" style="--path-len:12"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" style="--path-len:12"/></svg>`;

  return `
  <section class="chapter chapter--alt" data-ch="daily">
    <div class="chapter-inner">
      <div class="chapter-num" aria-hidden="true">02</div>
      <header class="chapter-hd">
        <div class="chapter-eyebrow">
          <span class="chapter-icon">${sunSvg}</span>
          Daily Life
        </div>
        <h2 class="chapter-title">What living here actually feels like.</h2>
      </header>
      <p class="chapter-intro">The stuff you'd only learn after living here for two years — or by reading this.</p>
      <div class="chapter-body">
        <div class="chapter-left">
          ${sectionsHTML}
        </div>
        <div class="chapter-right">
          ${calloutsHTML}
        </div>
      </div>
    </div>
  </section>
  <div class="chapter-rule"></div>`;
}


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
  <section class="chapter chapter--alt" data-ch="custom">
    <div class="chapter-inner">
      <div class="chapter-num" aria-hidden="true">★</div>
      <header class="chapter-hd">
        <div class="chapter-eyebrow">Your Places</div>
        <h2 class="chapter-title">Custom Destinations</h2>
      </header>
      <div class="chapter-body">
        <div class="chapter-left">
          ${itemsHTML}
        </div>
        <div class="chapter-right"></div>
      </div>
    </div>
  </section>
  <div class="chapter-rule"></div>`;
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
  <div class="chapter-inner chapter-inner--addon">
    ${narrativeHTML}
    <div class="services-grid">
      ${elementarySchool ? `<div class="services-grid-item">${buildDestSection('Elementary School', elementarySchool)}</div>` : ''}
      ${park ? `<div class="services-grid-item">${buildDestSection('Park', park)}</div>` : ''}
      ${coffeeShop ? `<div class="services-grid-item">${buildDestSection('Coffee Shop', coffeeShop)}</div>` : ''}
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
  const waveSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:80" aria-hidden="true"><polyline points="2 12 6 4 10 20 14 8 18 16 22 12" style="--path-len:80"/></svg>`;

  return `
  <section class="chapter" data-ch="traffic">
    <div class="chapter-inner">
      <div class="chapter-num" aria-hidden="true">04</div>
      <header class="chapter-hd">
        <div class="chapter-eyebrow">
          <span class="chapter-icon">${waveSvg}</span>
          Traffic Patterns
        </div>
        <h2 class="chapter-title">Drive times shift. Know the range before you commit.</h2>
      </header>
      <p class="chapter-intro">Drive times aren't fixed — they shift significantly based on when you leave. The "Worst" time is the one to internalize if you're planning a regular commute.</p>
    </div>
    <div class="chapter-full">
      ${sectionsHTML}
    </div>
  </section>
  <div class="chapter-rule"></div>`;
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

  const insightsCardHTML = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
  const additionalServicesCardHTML = buildAdditionalServicesCardHTML(elementarySchool, park, coffeeShop);
  const customDestinationsCardHTML = buildCustomDestinationsCardHTML(customDestinations);
  const trafficCardHTML = buildTrafficCardHTML(trafficData);
  const premiumSectionsHTML = buildPremiumSectionsHTML(premium || null);
  const healthSafetyChapterHTML = buildHealthSafetyChapterHTML(hospital, premium?.emergency);

  // Hero At-a-Glance insight rows (rendered inside the editorial hero block)
  const heroInsightRowsHTML = buildHeroInsightRowsHTML(hospital, school, highwayRamp, premium);

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

  // Share button (lives in the hero)
  const heroShareHTML = reportId ? `
    <div class="hero-share-area no-print">
      <button id="shareBtn" class="hero-share-btn">Share this report</button>
      <span id="shareToast" class="hero-share-toast hidden">Link copied!</span>
    </div>` : '';

  const shareScriptHTML = reportId ? `
  <script>
    (function () {
      var btn = document.getElementById('shareBtn');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var url = window.location.origin + '/r/' + '${reportId}';
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


  const safeAddrShort = escapeHtml(address.length > 50 ? address.slice(0, 47) + '…' : address);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably Report — ${escapeHtml(address)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/report.css">
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" defer><\/script>
</head>
<body class="report-page">
  <!-- Sticky nav — becomes visible on scroll -->
  <nav class="report-nav no-print" id="reportNav" aria-hidden="true">
    <div class="nav-logo">Liv<span class="logo-gold">ably</span></div>
    <div class="nav-address">${safeAddrShort}</div>
    <a id="navPdfLink" href="#" class="nav-pdf-btn"
       onclick="this.href='/report/pdf'+location.search.replace(/[?&]fetch=1/,'');return true;">PDF</a>
  </nav>

  <div class="report-hero">
    <div class="report-hero-inner">
      <div class="report-hero-eyebrow">
        <span class="report-hero-brand">Liv<span class="logo-gold">ably</span> Report</span>
        <span class="report-hero-date">${researchDate}</span>
      </div>
      <div class="report-hero-address">
        <h1 class="report-hero-street">${escapeHtml(street)}</h1>
        <div class="report-hero-city">${escapeHtml(cityState)}</div>
      </div>
      ${heroInsightRowsHTML}
      ${heroShareHTML}
    </div>
  </div>

  <div class="report-content">
    ${healthSafetyChapterHTML}
    ${insightsCardHTML}
    <section class="chapter chapter--alt" data-ch="reach">
      <div class="chapter-inner">
        <div class="chapter-num" aria-hidden="true">03</div>
        <header class="chapter-hd">
          <div class="chapter-eyebrow">
            <span class="chapter-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:130" aria-hidden="true"><circle cx="12" cy="12" r="10" style="--path-len:63"/><polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" style="--path-len:50"/></svg></span>
            Daily Reachability
          </div>
          <h2 class="chapter-title">The drives you'll make 300 times a year.</h2>
        </header>
        <p class="chapter-intro">You make these trips every week. Five minutes each way adds 50 hours a year. Here's what the math looks like for this address.</p>
        <div class="chapter-body">
          <div class="chapter-left">
            ${sectionsHTML}
          </div>
          <div class="chapter-right"></div>
        </div>
      </div>
    </section>
    <div class="chapter-rule"></div>
    ${additionalServicesCardHTML}${customDestinationsCardHTML}${trafficCardHTML}${premiumSectionsHTML}
    <footer class="footer">
      <div class="footer-brand">Liv<span class="logo-gold">ably</span></div>
      <div class="footer-meta">${researchDate} · ${escapeHtml(address)}</div>
      <div class="footer-legal">Drive times are estimates from Google Maps for 8am Tuesday departure. Assigned school requires verification with the local school district. For informational purposes only.</div>
      <div class="footer-actions no-print">
        <a id="pdfLink" href="#" class="btn-pdf" onclick="this.href='/report/pdf'+location.search.replace(/[?&]fetch=1/,'')">Download PDF</a>
      </div>
      <a href="/" class="back-link no-print">← Back to address form</a>
    </footer>
  </div>

  <script>
    // Sticky nav — appears after scrolling past hero
    (function () {
      var nav = document.getElementById('reportNav');
      if (!nav) return;
      var threshold = window.innerHeight * 0.7;
      function onScroll() {
        if (window.scrollY > threshold) {
          nav.classList.add('scrolled');
          nav.removeAttribute('aria-hidden');
        } else {
          nav.classList.remove('scrolled');
          nav.setAttribute('aria-hidden', 'true');
        }
      }
      window.addEventListener('scroll', onScroll, { passive: true });
    })();
  <\/script>
  ${shareScriptHTML}${saveHistoryScriptHTML}
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
  <title>Livably — Building your report…</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/report.css">
</head>
<body class="loading-page" data-address="${escapeHtml(address)}">
  <div class="loading-brand">Liv<span>ably</span></div>
  <div class="loading-address">${escapeHtml(address)}</div>
  <div class="loading-progress-track">
    <div class="loading-progress-fill" id="loading-progress"></div>
  </div>
  <p class="loading-message" id="loading-msg">Finding your address…</p>
  <script>
    (function () {
      var messages = [
        'Finding your address…',
        'Checking your flood zone…',
        'Finding the nearest emergency room…',
        'Calculating 8am Tuesday drive times…',
        'Identifying native plants for your yard…',
        'Locating nearby schools…',
        'Checking air quality and radon zone…',
        'Building your report…'
      ];
      var msgEl = document.getElementById('loading-msg');
      var progressEl = document.getElementById('loading-progress');
      var idx = 0;
      var address = document.body.dataset.address;

      // Animate progress bar
      var progressPct = 5;
      var maxAutoProgress = 85;
      progressEl.style.width = progressPct + '%';
      var progressInterval = setInterval(function () {
        progressPct = Math.min(progressPct + (Math.random() * 6 + 2), maxAutoProgress);
        progressEl.style.width = progressPct + '%';
      }, 2200);

      var cycleInterval = setInterval(function () {
        msgEl.style.opacity = '0';
        setTimeout(function () {
          idx = (idx + 1) % messages.length;
          msgEl.textContent = messages[idx];
          msgEl.style.opacity = '1';
        }, 280);
      }, 2200);

      setTimeout(function () {
        clearInterval(cycleInterval);
        msgEl.style.opacity = '0';
        setTimeout(function () {
          msgEl.textContent = 'This is taking longer than usual…';
          msgEl.style.opacity = '1';
        }, 280);
      }, 18000);

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
              clearInterval(progressInterval);
              startCountdown(doFetch);
              return;
            }
            // Complete progress bar before swapping DOM
            clearInterval(progressInterval);
            if (progressEl) progressEl.style.width = '100%';
            setTimeout(function () {
              document.head.innerHTML = doc.head.innerHTML;
              document.body.className = doc.body.className;
              document.body.innerHTML = doc.body.innerHTML;
              reExecScripts(document.head);
              reExecScripts(document.body);
            }, 300);
          })
          .catch(function () {
            clearInterval(cycleInterval);
            clearInterval(progressInterval);
            msgEl.style.opacity = '0';
            setTimeout(function () {
              msgEl.innerHTML = 'Connection issue. <a href="' + location.pathname + location.search + '">Try again</a>';
              msgEl.style.opacity = '1';
            }, 280);
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
    const locationInfo = await reverseGeocodeAddress(originLatLng);

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
    <a href="/" class="logo-link"><div class="logo">Liv<span class="logo-gold">ably</span></div></a>
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
    <a href="/" class="logo-link"><div class="logo">Liv<span class="logo-gold">ably</span></div></a>
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

let activePDFs = 0;

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
