'use strict';
const { escapeHtml } = require('../../utils/text');
const { badgeClass, renderChapterCard } = require('../components');

function buildCrimeHTML(crime, emergency) {
  if (!crime && !emergency) return '';
  const police = emergency?.police;
  const fire   = emergency?.fire;
  if (!police && !fire) return '';

  const city   = crime?.city   || '';
  const county = crime?.county || 'this county';

  // ── Police response ───────────────────────────────────────────────────────
  let policePara = '';
  if (police) {
    const mins = police.response.estimate;
    const cat  = police.response.category;
    const context =
      mins <= 5  ? `That's an excellent response time — faster than most suburban areas. Response quality at this level is genuinely meaningful in an emergency.` :
      mins <= 8  ? `That's a solid response time, consistent with typical suburban service levels and well within the range where outcomes are good across most emergency types.` :
      mins <= 12 ? `That's an average response time. For medical emergencies, every minute matters — knowing basic first aid and having a plan adds a real margin of safety.` :
      mins <= 20 ? `A ${mins}-minute response estimate is common for rural and exurban areas. Working smoke detectors, a CO detector, and a family emergency plan matter more when professional help is further away.` :
      `At ${mins} minutes, response is extended — typical for sparsely populated rural areas. Fire extinguishers on each floor, interconnected smoke alarms, and a practiced family escape plan are practical necessities here, not just suggestions.`;
    policePara = `The nearest police station is ${escapeHtml(police.name)}, ${police.distanceMiles} miles away. Estimated response time: <strong>~${mins} minutes</strong> <span class="prem-inline-badge ${badgeClass(cat.color)}">${escapeHtml(cat.label)}</span>. ${context}`;
  }

  // ── Fire response ─────────────────────────────────────────────────────────
  let firePara = '';
  if (fire) {
    const mins = fire.response.estimate;
    const cat  = fire.response.category;
    const context =
      mins <= 5  ? `That's an excellent fire response — critical for limiting structural damage. Homes near stations like this often qualify for lower homeowner's insurance rates (ISO rating 1–4 range).` :
      mins <= 8  ? `A ${mins}-minute fire response is solid — this is the range where professional suppression and modern systems work well together.` :
      mins <= 12 ? `A ${mins}-minute fire response means a fire has time to spread beyond one room. Working smoke detectors in every bedroom and a household fire escape plan are essential.` :
      `A ${mins}-minute fire response time is extended. A house fire doubles in size every minute — this is a meaningful practical consideration. Ask your insurance agent for the ISO fire protection class rating, which directly affects your premium.`;
    firePara = `${escapeHtml(fire.name)} is ${fire.distanceMiles} miles away. Estimated fire response: <strong>~${mins} minutes</strong> <span class="prem-inline-badge ${badgeClass(cat.color)}">${escapeHtml(cat.label)}</span>. ${context}`;
  }

  // ── Insurance / ISO note ──────────────────────────────────────────────────
  const isoNote = `The ISO Public Protection Classification (PPC) for this address determines your homeowner's insurance premium for fire coverage. Ratings 1–4 are excellent; 8–10 mean limited station coverage and higher premiums. Your insurance agent can pull this — it takes one minute and can be worth hundreds per year in premium differences.`;

  // ── 4-item research checklist ─────────────────────────────────────────────
  const actions = [
    {
      icon: '🗺️',
      label: 'Run a crime map',
      detail: `Search "crime map ${city || county}" — most police departments publish neighborhood-level incident maps. Look at the 3-month trend on your specific block, not the city average.`,
    },
    {
      icon: '🏘️',
      label: 'Find the neighborhood watch',
      detail: `Ask the listing agent if there's an active neighborhood watch. Search "[neighborhood name] Nextdoor" — active online communities indicate real neighbor engagement, which correlates with lower property crime.`,
    },
    {
      icon: '📞',
      label: 'Call the community resource officer',
      detail: `Call the non-emergency line for ${city ? escapeHtml(city) + ' Police' : 'the local police department'} and ask for the community resource officer for this precinct. They'll tell you more about the area than any statistic.`,
    },
    {
      icon: '🔐',
      label: 'Get the ISO fire protection rating',
      detail: `Ask your homeowner's insurance agent for the ISO PPC rating for this specific address. The number directly sets your fire coverage premium — it's address-specific, not neighborhood-level.`,
    },
  ];

  const actionsHTML = actions.map((a) => `
    <div class="prem-safety-action">
      <span class="prem-safety-action-icon">${a.icon}</span>
      <div class="prem-safety-action-text">
        <div class="prem-safety-action-label">${escapeHtml(a.label)}</div>
        <div class="prem-safety-action-detail">${a.detail}</div>
      </div>
    </div>`).join('');

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeaway;
  const pmins = police?.response?.estimate;
  const fmins = fire?.response?.estimate;
  if (pmins && pmins <= 5) {
    takeaway = `Police response of ~${pmins} min is excellent — a genuine safety asset for this address. Check the ISO fire protection rating with your insurance agent to confirm fire coverage costs.`;
  } else if (fmins && fmins > 12) {
    takeaway = `Fire station response of ~${fmins} min is extended. Get the ISO PPC rating before closing — it affects your insurance premium and tells you the official fire risk classification for this address.`;
  } else if (pmins && pmins > 15) {
    takeaway = `Police response of ~${pmins} min reflects a rural service area. A family emergency plan, working smoke and CO detectors, and fire extinguishers on every floor are practical necessities — not optional — at this response time.`;
  } else {
    takeaway = `Response times are within normal range for this area type. Run a crime map search on the specific block before you close — it takes 5 minutes and shows the street-level picture that neighborhood-level stats miss.`;
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const body = `
    <div class="prem-narrative">
      ${policePara ? `<p class="prem-narrative-lead">${policePara}</p>` : ''}
      ${firePara   ? `<p class="prem-narrative-body">${firePara}</p>`   : ''}
      <p class="prem-narrative-body">${isoNote}</p>
    </div>
    <div class="prem-safety-actions">
      <div class="prem-safety-actions-label">4 Things to Research Before You Close</div>
      ${actionsHTML}
    </div>
    <div class="key-takeaway">
      <span class="kt-icon">🔑</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${takeaway}</div>
    </div>
    <p class="prem-disclaimer">Response times are estimates based on station distance and typical dispatch speeds. Actual times vary by call volume and unit availability. Research date: ${today}. For current safety data, contact ${city ? escapeHtml(city) + ' Police or' : ''} ${escapeHtml(county)} Emergency Management.</p>`;
  const shieldSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:80" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  return renderChapterCard('safety', '06', shieldSvg, 'Safety & Emergency Response', 'Response times, fire coverage, and the things worth researching before you close.', null, body, null, null, null);
}

function buildEmergencyServicesHTML(emergency) {
  if (!emergency) return '';
  if (!emergency.police && !emergency.fire) return '';

  function serviceCard(icon, label, station) {
    if (!station) return `
    <div class="prem-emergency-card">
      <div class="prem-emergency-head">${icon} <span class="prem-emergency-label">${escapeHtml(label)}</span></div>
      <p class="prem-na">No ${escapeHtml(label.toLowerCase())} station found nearby.</p>
    </div>`;
    const cat = station.response.category;
    return `
    <div class="prem-emergency-card">
      <div class="prem-emergency-head">
        ${icon} <span class="prem-emergency-label">${escapeHtml(label)}</span>
        <span class="prem-badge prem-badge-right ${badgeClass(cat.color)}">~${station.response.estimate} min</span>
      </div>
      <div class="prem-emergency-name">${escapeHtml(station.name)}</div>
      <div class="prem-emergency-addr">${escapeHtml(station.address)}</div>
      <div class="prem-emergency-dist">${escapeHtml(station.distanceMiles)} miles away · Response: <strong>${escapeHtml(cat.label)}</strong></div>
    </div>`;
  }

  const fastestResponse = [emergency.police, emergency.fire]
    .filter(Boolean)
    .map((s) => s.response.estimate)
    .sort((a, b) => a - b)[0];
  const emergencyNarrative = fastestResponse != null
    ? fastestResponse <= 5
      ? `Emergency services reach this location quickly—estimated response times under ${fastestResponse + 1} minutes. That's meaningfully faster than average, and it reflects well on the density and positioning of local stations.`
      : fastestResponse <= 10
      ? `Emergency response times here are typical for residential areas—around ${fastestResponse} minutes on average. In most situations, that's enough time for basic first aid and preparing to receive responders. Knowing the address clearly posted outside your home speeds things up further.`
      : `Response times are longer than average at approximately ${fastestResponse} minutes. In a time-critical emergency—cardiac arrest, structure fire—every minute matters. Families in areas with longer response times often invest more in smoke detectors, carbon monoxide alarms, and basic CPR training as a practical buffer.`
    : '';

  const body = emergencyNarrative
    ? `<div class="prem-narrative"><p class="prem-narrative-body">${emergencyNarrative}</p></div>` +
      serviceCard('🚔', 'Police', emergency.police) +
      serviceCard('🚒', 'Fire Department', emergency.fire) +
      `<p class="prem-disclaimer">Response times are estimates based on distance to nearest stations. Actual times vary. Contact local emergency services for official data.</p>`
    : serviceCard('🚔', 'Police', emergency.police) +
      serviceCard('🚒', 'Fire Department', emergency.fire) +
      `<p class="prem-disclaimer">Response times are estimates based on distance to nearest stations. Actual times vary. Contact local emergency services for official data.</p>`;
  const emergShieldSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  return renderChapterCard('safety', '06', emergShieldSvg, 'Emergency Response', 'Your nearest responders and what their arrival time means.', null, body, null, null, null);
}

module.exports = { buildCrimeHTML, buildEmergencyServicesHTML };
