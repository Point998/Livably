'use strict';
const { escapeHtml } = require('../../utils/text');
const { badgeClass, renderChapterCard } = require('../../templates/components');

const ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

const SATELLITE_LINE = 'Even where wired options are thin, satellite internet now reaches roughly 100–300 Mbps almost anywhere — a workable backstop for this address.';

function internetFallback() {
  return `<p class="prem-narrative-body">No internet providers were returned for this address through the FCC National Broadband Map. Check current availability at <a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noopener noreferrer">broadbandmap.fcc.gov</a> by entering the address directly. ${SATELLITE_LINE}</p>`;
}

function evFallback() {
  return `<p class="prem-narrative-body">No public charging stations were returned for this area through the U.S. DOE Alternative Fuel Data Center or OpenChargeMap. Search current stations at <a href="https://afdc.energy.gov/stations" target="_blank" rel="noopener noreferrer">afdc.energy.gov/stations</a>.</p>`;
}

function buildElectricSection(u) {
  // State 3: nothing -> actionable link fallback (unchanged copy)
  if (!u.electric) {
    const state = u.locationInfo?.state || 'your state';
    return `
      <div class="prem-intel-section">
        <div class="prem-intel-label">Electric Service</div>
        <p class="prem-narrative-body">The electric provider and rate for this address weren't returned by NREL. Look up your provider and residential rate at the <a href="https://apps.openei.org/USURDB/" target="_blank" rel="noopener noreferrer">OpenEI Utility Rate Database</a>, or check the ${escapeHtml(state)} Public Service Commission site.</p>
      </div>`;
  }
  const { utilityName } = u.electric;
  const typeLabel = u.utilityType ? `<span class="prem-badge ${badgeClass('muted')}">${escapeHtml(u.utilityType.label)}</span>` : '';
  const provenance = (u.electricSource && u.electricSource !== 'NREL')
    ? `<p class="prem-disclaimer">Provider via HIFLD Electric Retail Service Territories.</p>`
    : '';

  // State 2: provider known, per-address rate unknown -> state-average context
  if (!u.rateContext) {
    const state = u.locationInfo?.state || 'your state';
    const ctx = (u.stateAvgRate != null)
      ? `Typical residential rate in ${escapeHtml(state)} is about ${Math.round(u.stateAvgRate * 100)}¢/kWh; a provider-specific rate wasn't available for this address.`
      : `A provider-specific rate wasn't available for this address.`;
    return `
      <div class="prem-intel-section">
        <div class="prem-intel-label">Electric Service</div>
        <p class="prem-narrative-body"><strong>${escapeHtml(utilityName)}</strong> ${typeLabel}</p>
        <p class="prem-narrative-body">${ctx}</p>
        ${provenance}
      </div>`;
  }

  // State 1: full NREL (provider + per-address rate vs state)
  const rateBadge = `<span class="prem-badge ${badgeClass(u.rateContext.color)}">${escapeHtml(u.rateContext.deltaLabel)}</span>`;
  return `
    <div class="prem-intel-section">
      <div class="prem-intel-label">Electric Service ${rateBadge}</div>
      <p class="prem-narrative-body"><strong>${escapeHtml(utilityName)}</strong> ${typeLabel}</p>
      <p class="prem-narrative-body">${escapeHtml(u.rateContext.narrative)}</p>
      ${provenance}
    </div>`;
}

function buildReliabilitySection(u) {
  if (!u.outage) return '';
  return `
    <div class="prem-intel-section">
      <div class="prem-intel-label">Grid Reliability</div>
      <p class="prem-narrative-body">${escapeHtml(u.outage.narrative)}</p>
    </div>`;
}

function buildServicesSection(u) {
  const s = u.services;
  if (!s) return '';
  return `
    <div class="prem-intel-section">
      <div class="prem-intel-label">Water, Sewer &amp; Gas (Likely)</div>
      <p class="prem-narrative-body">${escapeHtml(s.water)}. ${escapeHtml(s.sewer)}. ${escapeHtml(s.gas)}.</p>
      <p class="prem-disclaimer">${escapeHtml(s.verifyAction)}</p>
    </div>`;
}

function buildInternetSection(u) {
  const net = u.internet;
  if (!net) {
    return `
      <div class="prem-intel-section">
        <div class="prem-intel-label">Internet</div>
        ${internetFallback()}
      </div>`;
  }
  const bandBadge = `<span class="prem-badge ${badgeClass(net.band.color)}">${escapeHtml(net.band.label)}</span>`;
  const who = net.providerCount > 0
    ? `${net.providerCount} provider${net.providerCount === 1 ? '' : 's'} serve this address.`
    : "Provider details weren't itemized for this address.";
  const sat = net.satelliteFloor ? ` ${SATELLITE_LINE}` : '';
  return `
    <div class="prem-intel-section">
      <div class="prem-intel-label">Internet ${bandBadge}</div>
      <p class="prem-narrative-body">${escapeHtml(who)} ${escapeHtml(net.meaning)}${sat}</p>
    </div>`;
}

function buildBody(u) {
  let takeaway;
  if (u.rateContext?.deltaLabel === 'above state average') {
    takeaway = 'Electricity here runs above the state average — factor a slightly higher monthly bill into your cost picture, and ask the seller for recent utility statements.';
  } else if (u.services?.water?.match(/well/i)) {
    takeaway = 'This address is likely on a private well and septic system. Budget for periodic testing and maintenance, and make a well/septic inspection part of your due diligence.';
  } else if (u.evCost) {
    takeaway = `If you drive electric, a full home charge here costs about $${u.evCost.fullChargeCost.toFixed(2)} — far below public fast-charging.`;
  } else {
    takeaway = 'Confirm water, sewer, and gas service on the seller\'s disclosure before closing — these set your monthly costs for as long as you own the home.';
  }

  return `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">Who powers this home, what it costs relative to the state, how reliable the grid is, and what services the lot is likely on — the monthly costs you'll carry for as long as you live here.</p>
    </div>
    ${buildElectricSection(u)}
    ${buildReliabilitySection(u)}
    ${buildServicesSection(u)}
    ${buildInternetSection(u)}
    <div class="key-takeaway">
      <span class="kt-icon">🔌</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${escapeHtml(takeaway)}</div>
    </div>`;
}

function buildElectricTab(u) {
  // State 3: no provider at all -> actionable link fallback
  if (!u.electric) {
    const state = u.locationInfo?.state || 'your state';
    return `<p class="prem-narrative-body">Electric provider data wasn't returned by NREL for this address. Look up your provider and residential rate at the <a href="https://apps.openei.org/USURDB/" target="_blank" rel="noopener noreferrer">OpenEI Utility Rate Database</a>, or the ${escapeHtml(state)} Public Service Commission site.</p>`;
  }
  const provenance = (u.electricSource && u.electricSource !== 'NREL')
    ? `<p class="prem-disclaimer">Provider via HIFLD Electric Retail Service Territories.</p>`
    : '';
  // State 2: provider known, per-address rate unknown -> state-average context
  if (!u.rateContext) {
    const state = u.locationInfo?.state || 'your state';
    const ctx = (u.stateAvgRate != null)
      ? `Typical residential rate in ${escapeHtml(state)} is about ${Math.round(u.stateAvgRate * 100)}¢/kWh; a provider-specific rate wasn't available for this address.`
      : `A provider-specific rate wasn't available for this address.`;
    return `
    <p class="prem-narrative-body">${escapeHtml(u.electric.utilityName)} serves this address. ${u.utilityType ? escapeHtml(u.utilityType.label) + '.' : ''}</p>
    <p class="prem-narrative-body">${ctx}</p>
    ${provenance}`;
  }
  // State 1: full NREL (provider + per-address rate vs state)
  const centsRate = Math.round(u.rateContext.rate * 100);
  const centsAvg  = Math.round(u.rateContext.stateAvg * 100);
  return `
    <p class="prem-narrative-body">${escapeHtml(u.electric.utilityName)} serves this address. ${u.utilityType ? escapeHtml(u.utilityType.label) + '.' : ''}</p>
    <p class="prem-narrative-body">Residential rate: about <strong>${centsRate}¢/kWh</strong> vs the ${escapeHtml(u.locationInfo?.state || '')} average of about ${centsAvg}¢/kWh — ${escapeHtml(u.rateContext.deltaLabel)}.</p>
    <p class="prem-disclaimer">Source: NREL / OpenEI Utility Rate Database. Rate is the provider's residential average, not a parcel-specific bill.</p>
    ${provenance}`;
}

function buildReliabilityTab(u) {
  if (!u.outage) return `<p class="prem-narrative-body">State reliability data was not available.</p>`;
  return `
    <p class="prem-narrative-body">${escapeHtml(u.outage.narrative)}</p>
    <p class="prem-narrative-body">SAIDI (avg hours of interruption/yr): <strong>${u.outage.saidiHours}</strong> · SAIFI (avg interruptions/yr): <strong>${u.outage.saifiEvents}</strong>.</p>
    <p class="prem-disclaimer">Source: U.S. EIA-861 distribution reliability (IEEE 1366), excluding major event days. State-level average.</p>`;
}

function buildEvTab(u) {
  if (!u.evCharging) return evFallback();
  const evProvenance = (u.evSource === 'OpenChargeMap')
    ? `<p class="prem-disclaimer">Charger data via OpenChargeMap.</p>`
    : '';
  const card = (s, kind) => s
    ? `<div class="prem-intel-bb-provider prem-intel-bb-provider--full">
         <span class="prem-intel-bb-name">${escapeHtml(s.name)}</span>
         <span class="prem-intel-bb-tech">${kind}</span>
         <span class="prem-intel-bb-speed">${s.driveTimeMinutes != null ? `${s.driveTimeMinutes} min drive` : `${escapeHtml(s.distanceMiles)} mi`}</span>
       </div>`
    : `<p class="prem-narrative-body">No public ${kind} charger found nearby.</p>`;
  const cost = u.evCost
    ? `<p class="prem-narrative-body">${escapeHtml(u.evCost.homeNote)}</p>`
    : '';
  return `
    <div class="prem-intel-bb-providers">
      ${card(u.evCharging.level2, 'Level 2')}
      ${card(u.evCharging.dcFast, 'DC Fast')}
    </div>
    ${cost}
    <p class="prem-disclaimer">Source: U.S. DOE Alternative Fuel Data Center. Drive time via Google, 8am Tuesday departure.</p>
    ${evProvenance}`;
}

function buildInternetTab(u) {
  const net = u.internet;
  if (!net) return internetFallback();
  const bandBadge = `<span class="prem-badge ${badgeClass(net.band.color)}">${escapeHtml(net.band.label)}</span>`;
  const cards = net.providers.length
    ? `<div class="prem-intel-bb-providers">
         ${net.providers.map((p) => `
         <div class="prem-intel-bb-provider prem-intel-bb-provider--full">
           <span class="prem-intel-bb-name">${escapeHtml(p.name)}</span>
           <span class="prem-intel-bb-tech">${escapeHtml(p.tech)}</span>
         </div>`).join('')}
       </div>`
    : '';
  const sat = net.satelliteFloor ? `<p class="prem-narrative-body">${SATELLITE_LINE}</p>` : '';
  return `
    <p class="prem-narrative-body">${bandBadge} ${escapeHtml(net.meaning)}</p>
    ${cards}
    ${sat}
    <p class="prem-disclaimer">Source: FCC National Broadband Map. Advertised availability, not measured speeds.</p>`;
}

function buildDeepDive(u) {
  const tabs = [
    { id: 'electric',    label: 'Electric',    content: buildElectricTab(u) },
    { id: 'reliability', label: 'Reliability', content: buildReliabilityTab(u) },
    { id: 'ev',          label: 'EV Charging',  content: buildEvTab(u) },
    { id: 'internet',    label: 'Internet',    content: buildInternetTab(u) },
  ];
  const buttons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="utiltab-${t.id}" id="utilbtn-${t.id}">${t.label}</button>`).join('');
  const panels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="utiltab-${t.id}" role="tabpanel" aria-labelledby="utilbtn-${t.id}">${t.content}</div>`).join('');
  return `
    <div class="property-deep-dive">
      <div class="community-deep-dive-label">Utilities in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Utilities deep dive">${buttons}</nav>
      <div class="climate-tab-panels">${panels}</div>
    </div>`;
}

function buildResearch(u) {
  const state  = u.locationInfo?.state  || '';
  const county = u.locationInfo?.county || 'this county';
  const outageSearch = `https://www.google.com/search?q=${encodeURIComponent(`${u.electric?.utilityName || state + ' electric utility'} outage map`)}`;
  const serviceSearch = `https://www.google.com/search?q=${encodeURIComponent(`${county} county water sewer service area`)}`;
  const ispSearch = `https://www.google.com/search?q=${encodeURIComponent(`internet providers ${county} county ${state}`)}`;
  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Verify &amp; Go Deeper</div>
      <ul class="climate-research-links">
        <li><a href="https://apps.openei.org/USURDB/" target="_blank" rel="noopener noreferrer">OpenEI Utility Rate Database — provider &amp; rate</a></li>
        <li><a href="https://www.eia.gov/electricity/data/eia861/" target="_blank" rel="noopener noreferrer">EIA-861 — utility reliability data</a></li>
        <li><a href="${outageSearch}" target="_blank" rel="noopener noreferrer">Your utility's live outage map</a></li>
        <li><a href="${serviceSearch}" target="_blank" rel="noopener noreferrer">${escapeHtml(county)} water &amp; sewer service-area lookup</a></li>
        <li><a href="https://afdc.energy.gov/stations" target="_blank" rel="noopener noreferrer">DOE Alternative Fuel Data Center — EV charging stations</a></li>
        <li><a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noopener noreferrer">FCC National Broadband Map — internet providers at this address</a></li>
        <li><a href="${ispSearch}" target="_blank" rel="noopener noreferrer">Search internet providers in ${escapeHtml(county)} County</a></li>
      </ul>
    </div>`;
}

function buildGlance(u) {
  if (!u.electric) return '';
  const parts = [
    `<span class="chapter-glance-item">${escapeHtml(u.electric.utilityName)}</span>`,
    u.rateContext ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">${escapeHtml(u.rateContext.deltaLabel)}</span>` : '',
  ].filter(Boolean).join('');
  return `<div class="chapter-glance">${parts}</div>`;
}

function buildUtilitiesHTML(utilities) {
  if (!utilities) return '';
  const body = buildBody(utilities);
  const glance = buildGlance(utilities);
  const fullHTML = [
    `<div class="depth-l3">${buildDeepDive(utilities)}</div>`,
    `<div class="depth-l4">${buildResearch(utilities)}</div>`,
  ].join('');
  return renderChapterCard(
    'utilities', '15', ICON,
    'Utilities & Power',
    'What you\'ll pay, who provides it, and how reliable it is.',
    null, body, null, fullHTML, null, glance || null,
  );
}

module.exports = { buildUtilitiesHTML };
