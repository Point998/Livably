'use strict';

const { escapeHtml, formatDriveTime, parseAddressParts, formatResearchDate } = require('../../utils/text');
const { HIGHWAY_MAX_DRIVE_MINUTES } = require('../../utils/constants');
const { buildInsightsCardHTML, buildCustomDestinationsCardHTML, buildAdditionalServicesCardHTML } = require('../chapters/reachability');
const { buildTrafficCardHTML } = require('../chapters/traffic');
const { buildHealthSafetyChapterHTML } = require('../chapters/health');
const { buildChaptersHTML } = require('../../chapters');

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


function buildHeroInsightRowsHTML(hospital, school, highwayRamp, chapters) {
  const findings = [];
  const env = chapters?.environment;

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


function buildReportHTML(address, { grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool, customDestinations, trafficData, origin, reportId, chapters }) {
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
  const chapterSectionsHTML = buildChaptersHTML(chapters || null);
  const healthSafetyChapterHTML = buildHealthSafetyChapterHTML(hospital, chapters?.emergency);

  // Hero At-a-Glance insight rows (rendered inside the editorial hero block)
  const heroInsightRowsHTML = buildHeroInsightRowsHTML(hospital, school, highwayRamp, chapters);

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
            <span class="chapter-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/></svg></span>
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
    ${additionalServicesCardHTML}${customDestinationsCardHTML}${trafficCardHTML}${chapterSectionsHTML}
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

module.exports = {
  buildGrocerySection,
  buildDestSection,
  buildSchoolSection,
  buildHeroInsightRowsHTML,
  buildReportHTML,
};
