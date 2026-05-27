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
const { loadMitigations } = require('./errorMemory');

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
  HIGHWAY_MAX_DRIVE_MINUTES,
  MAX_CONCURRENT_PDFS,
  CUSTOM_DEST_ICONS, ERROR_ICONS,
} = require('./utils/constants');
const { buildHealthSafetyChapterHTML } = require('./templates/chapters/health');
const { buildInsightsCardHTML, buildCustomDestinationsCardHTML, buildAdditionalServicesCardHTML } = require('./templates/chapters/reachability');
const { buildTrafficCardHTML } = require('./templates/chapters/traffic');

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


function buildHeroInsightRowsHTML(hospital, school, highwayRamp, premium) {
  const findings = [];
  const env = premium?.environment;

  const flood = env?.floodRisk;
  if (flood) {
    if (flood.risk === 'High' || flood.risk === 'Very High') {
      findings.push({ bucket: 'Things to Check', cls: 'check',
        text: `FEMA Flood Zone ${flood.zone} â€” flood insurance required, adds $1,500â€“$4,000/year.` });
    } else if (flood.zone === 'X') {
      findings.push({ bucket: 'Cool Things to Know', cls: 'cool',
        text: `Outside FEMA high-risk flood zones (Zone X) â€” flood insurance not federally required.` });
    } else {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `FEMA Flood Zone ${flood.zone} â€” moderate risk area, worth pricing flood insurance before closing.` });
    }
  }

  if (school) {
    findings.push({ bucket: 'Things to Check', cls: 'check',
      text: `Nearest school: ${school.name} (${school.driveTimeMinutes} min). Assigned school requires district verification.` });
  }

  if (hospital) {
    if (hospital.driveTimeMinutes > 20) {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `Nearest ER (${hospital.name}) is ${hospital.driveTimeMinutes} min away â€” farther than average.` });
    } else if (hospital.driveTimeMinutes <= 10) {
      findings.push({ bucket: 'Cool Things to Know', cls: 'cool',
        text: `${hospital.name} is ${hospital.driveTimeMinutes} min away â€” full emergency department within quick reach.` });
    } else {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `Nearest ER (${hospital.name}) is ${hospital.driveTimeMinutes} min â€” know your route before you need it.` });
    }
  }

  if (highwayRamp) {
    if (highwayRamp.driveTimeMinutes <= 8) {
      findings.push({ bucket: 'Cool Things to Know', cls: 'cool',
        text: `${highwayRamp.name} is ${highwayRamp.driveTimeMinutes} min away â€” quick highway access.` });
    } else if (highwayRamp.driveTimeMinutes > HIGHWAY_MAX_DRIVE_MINUTES) {
      findings.push({ bucket: 'Things to Consider', cls: 'consider',
        text: `${highwayRamp.name} is ${highwayRamp.driveTimeMinutes} min â€” regional travel adds meaningful time.` });
    }
  }

  const radon = env?.radon;
  if (radon && radon.zone === 1) {
    findings.push({ bucket: 'Things to Check', cls: 'check',
      text: `EPA Radon Zone 1 (high potential) â€” a $15â€“$30 test before closing is strongly recommended.` });
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


function buildReportHTML(address, { grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool, customDestinations, trafficData, origin, reportId, premium }) {
  const { street, cityState } = parseAddressParts(address);
  const researchDate = formatResearchDate();

  const sectionsHTML = [
    buildGrocerySection(grocery),
    buildDestSection('Pharmacy', pharmacy),
    buildDestSection('Hospital â€” Full Emergency Department', hospital),
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


  const safeAddrShort = escapeHtml(address.length > 50 ? address.slice(0, 47) + 'â€¦' : address);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably Report â€” ${escapeHtml(address)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/report.css">
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" defer><\/script>
</head>
<body class="report-page">
  <!-- Sticky nav â€” becomes visible on scroll -->
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
      <div class="footer-meta">${researchDate} Â· ${escapeHtml(address)}</div>
      <div class="footer-legal">Drive times are estimates from Google Maps for 8am Tuesday departure. Assigned school requires verification with the local school district. For informational purposes only.</div>
      <div class="footer-actions no-print">
        <a id="pdfLink" href="#" class="btn-pdf" onclick="this.href='/report/pdf'+location.search.replace(/[?&]fetch=1/,'')">Download PDF</a>
      </div>
      <a href="/" class="back-link no-print">â† Back to address form</a>
    </footer>
  </div>

  <script>
    // Sticky nav â€” appears after scrolling past hero
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
  const icon = ERROR_ICONS[type] || 'âš ï¸';
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
  <title>Livably â€” Building your reportâ€¦</title>
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
  <p class="loading-message" id="loading-msg">Finding your addressâ€¦</p>
  <script>
    (function () {
      var messages = [
        'Finding your addressâ€¦',
        'Checking your flood zoneâ€¦',
        'Finding the nearest emergency roomâ€¦',
        'Calculating 8am Tuesday drive timesâ€¦',
        'Identifying native plants for your yardâ€¦',
        'Locating nearby schoolsâ€¦',
        'Checking air quality and radon zoneâ€¦',
        'Building your reportâ€¦'
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
          msgEl.textContent = 'This is taking longer than usualâ€¦';
          msgEl.style.opacity = '1';
        }, 280);
      }, 18000);

      function startCountdown(retryFn) {
        var secs = 30;
        msgEl.textContent = 'Too many requests. Retrying in ' + secs + 'sâ€¦';
        var timer = setInterval(function () {
          secs--;
          if (secs <= 0) {
            clearInterval(timer);
            retryFn();
          } else {
            msgEl.textContent = 'Too many requests. Retrying in ' + secs + 'sâ€¦';
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

    // Reverse geocode for city/state/county â€” used by crime data and property data
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

// â”€â”€ Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        <td style="padding:6px 10px;font-size:12px;color:#555">${f.topErrors[0] || 'â€”'}</td>
      </tr>`).join('');

  const mitRows = Object.entries(mitigations)
    .filter(([k]) => k !== 'updatedAt')
    .map(([fn, m]) => `
      <tr>
        <td style="padding:6px 10px;font-family:monospace;font-size:13px">${fn}</td>
        <td style="padding:6px 10px">${JSON.stringify(Object.fromEntries(Object.entries(m).filter(([k]) => !['reason','appliedAt'].includes(k))))}</td>
        <td style="padding:6px 10px;font-size:12px;color:#555">${m.reason || 'â€”'}</td>
        <td style="padding:6px 10px;font-size:12px;color:#888">${m.appliedAt ? new Date(m.appliedAt).toLocaleDateString() : 'â€”'}</td>
      </tr>`).join('');

  const errorRows = recentErrors.map((e) => `
    <tr>
      <td style="padding:5px 10px;font-size:12px;color:#888">${new Date(e.ts).toLocaleTimeString()}</td>
      <td style="padding:5px 10px;font-family:monospace;font-size:12px">${e.fn || 'â€”'}</td>
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
  <title>Livably â€” Health Dashboard</title>
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
  <div class="meta">7-day window Â· analyzed ${patterns?.analyzedAt ? new Date(patterns.analyzedAt).toLocaleString() : 'never'} Â· API usage resets on restart</div>

  ${flagged.length ? `<div class="flag-banner">âš ï¸ <strong>${flagged.length} function${flagged.length > 1 ? 's' : ''} flagged:</strong> ${flagged.map(([fn, f]) => `${fn} (${pct(f.failureRate)})`).join(', ')}</div>` : ''}

  <div class="cards">
    <div class="card">
      <div class="card-label">Total Requests (7d)</div>
      <div class="card-value">${stats?.total ?? 'â€”'}</div>
    </div>
    <div class="card">
      <div class="card-label">Success Rate (7d)</div>
      <div class="card-value ${stats?.successRate >= 0.9 ? 'ok' : stats?.successRate >= 0.7 ? 'warn' : 'warn'}">${pct(stats?.successRate)}</div>
    </div>
    <div class="card">
      <div class="card-label">Errors (7d)</div>
      <div class="card-value ${(stats?.error || 0) > 0 ? 'warn' : 'ok'}">${stats?.error ?? 'â€”'}</div>
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
  <title>Compare Addresses â€” Livably</title>
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
  <title>Livably â€” Comparingâ€¦</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="loading-page" data-addresses="${escapeHtml(addressesParam)}">
  <div class="loading-container">
    <div class="loading-logo">Liv<span class="logo-gold">ably</span></div>
    <div class="loading-spinner"></div>
    <p class="loading-message">Researching addressesâ€¦</p>
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
      if (time === null) return '<td class="compare-cell compare-cell-na">â€”</td>';
      const best = time === minTime && validTimes.length > 1;
      return `<td class="compare-cell${best ? ' compare-cell-best' : ''}">${time} min${best ? ' <span class="compare-winner">âœ“</span>' : ''}</td>`;
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
  <title>Address Comparison â€” Livably</title>
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
    <a href="/compare" class="back-link">â† Compare different addresses</a>
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

// â”€â”€ PDF Export (FR-016) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // Block external font CDN requests â€” prevents large font embedding in PDF.
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ensureReportsFile();
app.listen(port, () => {
  console.log(`Livably app running at http://localhost:${port}`);
});
