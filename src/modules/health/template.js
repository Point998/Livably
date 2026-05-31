'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderDepthSelector } = require('../../templates/components/depthSelector');

function buildHealthGlanceHTML(hospital, emergency) {
  const fire = emergency?.fire;
  const erItem = hospital
    ? `<span class="chapter-glance-item">ER: ${escapeHtml(hospital.name)} — ${hospital.driveTimeMinutes} min</span>`
    : '';
  const fireItem = fire
    ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">Fire: ~${fire.response.estimate} min <span class="prem-badge badge-${escapeHtml(fire.response.category.color)}">${escapeHtml(fire.response.category.label)}</span></span>`
    : '';
  return `<div class="chapter-glance">${erItem}${fireItem}</div>`;
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
  <section class="chapter" data-ch="health" data-depth="overview">
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
      <div class="depth-l1">${buildHealthGlanceHTML(hospital, emergency)}</div>
      <div class="chapter-body depth-l2">
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
      ${renderDepthSelector('health')}
    </div>
  </section>
  <div class="chapter-rule"></div>`;
}

module.exports = { buildHealthSafetyChapterHTML };
