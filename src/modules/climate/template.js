'use strict';
const { escapeHtml } = require('../../utils/text');
const { badgeClass } = require('../../templates/components/badge');
const { renderChapterCard } = require('../../templates/components/chapterCard');
const {
  CLIMATE_FEMA_LOOKBACK_YEARS,
  CLIMATE_STORM_LOOKBACK_YEARS,
} = require('../../utils/constants');
const { computeRarityStatement: _computeRarityStatement } = require('./logic');

function buildClimateGlanceHTML(environment, climateHistory) {
  const flood = environment?.floodRisk;
  const zoneText = flood ? `Zone ${escapeHtml(flood.zone)}` : 'Zone Unknown';
  const zoneColor = (!flood || flood.zone === 'X') ? 'green'
    : (flood.risk === 'High' || flood.risk === 'Very High') ? 'red' : 'gold';

  const lastEvt = climateHistory?.glance?.lastSignificantEvent;
  const lastEvtText = lastEvt
    ? `Last significant event: ${escapeHtml(lastEvt.type)}, ${lastEvt.year}`
    : 'No federally declared disasters in 20 years';

  return `<div class="climate-glance">
    <span class="climate-glance-badge climate-glance-badge--${zoneColor}">${zoneText}</span>
    <span class="climate-glance-sep">·</span>
    <span class="climate-glance-event">${escapeHtml(lastEvtText)}</span>
  </div>`;
}

function buildWatershedHTML(watershed) {
  if (!watershed) return '';
  if (watershed.topographicPosition === 'lowpoint') {
    return `<p class="prem-narrative-body things-to-check">This address sits at a low point in the surrounding terrain — stormwater from uphill areas drains toward this elevation. Ask the seller specifically whether the yard or basement has experienced water intrusion during heavy rain events.</p>`;
  }
  if (watershed.topographicPosition === 'uphill') {
    return `<p class="prem-narrative-body">This address sits above the surrounding terrain — stormwater drains away from rather than toward this parcel, which is a modest advantage during heavy rain events.</p>`;
  }
  return '';
}

function buildClimateChapterHTML(environment, climateHistory, locationInfo) {
  if (!environment && !climateHistory) return '';
  const flood  = environment?.floodRisk;
  const state  = locationInfo?.state || null;
  const county = locationInfo?.county || 'this county';
  const tornado = state ? getTornadoTier(state) : null;

  // Overview additions
  const femaCount = climateHistory?.femaDeclarations?.count || 0;
  const femaCountHTML = femaCount > 0
    ? `<p class="prem-narrative-body">${escapeHtml(county)} has received ${femaCount} federal weather-related disaster declaration${femaCount === 1 ? '' : 's'} in the last ${CLIMATE_FEMA_LOOKBACK_YEARS} years.</p>`
    : '';
  const watershedHTML = buildWatershedHTML(climateHistory?.watershed);

  // ── Flood section ─────────────────────────────────────────────────────────
  let floodPara = '';
  let floodAction = '';
  let floodBadgeColor = 'green';
  if (flood) {
    const zone = flood.zone || 'X';
    const risk = flood.risk || 'Minimal';
    if (risk === 'High' || risk === 'Very High') {
      floodBadgeColor = 'red';
      floodPara = `This parcel falls in FEMA Flood Zone <strong>${escapeHtml(zone)}</strong> — a high-risk area with a 1% annual flood chance. Over a 30-year mortgage that translates to a <strong>26% probability of at least one flood event</strong>. Flood insurance is federally required for federally-backed mortgages on this property. NFIP policies for Zone A/AE properties typically run <strong>$1,500–$3,500/year</strong>, though elevation can significantly change that figure. Request an elevation certificate from the seller — it's the single best tool for accurately quoting flood insurance and potentially reducing the premium.`;
      floodAction = 'Get flood insurance quotes before your inspection period ends — the premium varies widely based on the elevation certificate, and a surprise here can change your offer math.';
    } else if (risk === 'Moderate') {
      floodBadgeColor = 'gold';
      floodPara = `This parcel is in FEMA Flood Zone <strong>${escapeHtml(zone)}</strong> — a moderate-risk area (0.2% annual flood chance, or roughly 6% over a 30-year mortgage). Flood insurance is not federally required here, but <strong>25% of NFIP claims come from outside high-risk zones</strong>. A preferred-risk policy in moderate zones typically costs $300–$700/year and is worth considering if the property has low-lying areas or sits near a drainage channel.`;
      floodAction = "Confirm your zone at msc.fema.gov — boundaries shift over time and one parcel can differ from the neighbor's. A flood insurance quote takes 15 minutes and locks in your cost picture before closing.";
    } else {
      floodBadgeColor = 'green';
      floodPara = `This parcel is in FEMA Flood Zone <strong>${escapeHtml(zone)}</strong> — outside high-risk flood areas. No federally required flood insurance for this address. That said, <strong>25% of NFIP claims still come from Zone X properties</strong> — mostly from heavy rainfall events and local drainage issues rather than river flooding. A preferred-risk policy in Zone X runs around $300–$500/year if you want a cushion.`;
      floodAction = 'Verify your exact zone at msc.fema.gov using the specific parcel address — flood maps are updated periodically and this is the authoritative source.';
    }
  } else {
    floodPara = 'Flood zone data could not be retrieved for this address. Verify directly with FEMA\'s Flood Map Service Center at <strong>msc.fema.gov</strong> before closing — this is the only authoritative parcel-level source.';
    floodBadgeColor = 'muted';
    floodAction = 'Look up this address at msc.fema.gov before your inspection period closes. Flood zone status affects your insurance requirement and cost.';
  }

  // ── Tornado section ───────────────────────────────────────────────────────
  const tornadoHTML = tornado ? `
    <div class="prem-climate-row">
      <div class="prem-climate-row-label">
        🌪️ Tornado Frequency
        <span class="prem-badge ${badgeClass(tornado.color)}">${escapeHtml(tornado.tier)}</span>
      </div>
      <p class="prem-climate-row-body">${escapeHtml(tornado.note)}</p>
    </div>` : '';

  // ── Action checklist ──────────────────────────────────────────────────────
  const actions = [
    {
      icon: '🗺️',
      label: 'Verify your flood zone at msc.fema.gov',
      detail: floodAction,
    },
    {
      icon: '📋',
      label: 'Request the elevation certificate',
      detail: "Ask the seller's agent for the Elevation Certificate (EC) if one exists. It determines your flood insurance premium more than anything else — a 2-foot elevation advantage can cut a premium by 50%.",
    },
    {
      icon: '💰',
      label: 'Get a flood insurance quote before your deadline',
      detail: "Contact your homeowner's insurance agent or visit floodsmart.gov for NFIP quotes. Flood insurance has a 30-day waiting period before it takes effect — get quotes during inspection, not at closing.",
    },
    {
      icon: '🏠',
      label: 'Ask about storm shelter and drainage',
      detail: `Ask the seller about the property's drainage and whether neighbors have experienced basement or yard flooding after heavy rain. In ${escapeHtml(county)}, local drainage patterns often matter more than the FEMA zone designation.`,
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
  if (!flood) {
    takeaway = 'Flood zone data was unavailable — look up this address at msc.fema.gov before closing. It\'s a 2-minute check that can reveal a $1,500–$3,500/year insurance requirement you won\'t see anywhere else in the listing.';
  } else if (flood.risk === 'High' || flood.risk === 'Very High') {
    takeaway = `Zone ${escapeHtml(flood.zone)} is a federally designated high-risk flood area. Flood insurance is required and will cost $1,500–$3,500/year minimum. Get the elevation certificate and insurance quote before your inspection period ends — this number changes your total monthly cost.`;
  } else if (flood.risk === 'Moderate') {
    takeaway = `Zone ${escapeHtml(flood.zone)} is a moderate-risk area — no federal requirement, but a preferred-risk policy is cheap here ($300–$700/year). Verify the boundary at msc.fema.gov; flood map updates can shift a parcel from X to AE without any visible change to the property.`;
  } else {
    takeaway = `Zone ${escapeHtml(flood.zone)}: outside high-risk flood areas — no flood insurance required. Confirm at msc.fema.gov to lock in that status. Zone X properties still account for 1 in 4 flood insurance claims, usually from heavy rain rather than river overflow.`;
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const floodBadge = flood ? `<span class="prem-badge ${badgeClass(floodBadgeColor)}">Zone ${escapeHtml(flood.zone)} · ${escapeHtml(flood.risk)} Risk</span>` : `<span class="prem-badge badge-muted">Zone Unknown</span>`;

  const bannerClass = (!flood || flood.zone === 'X') ? 'flood-banner--low'
    : (flood.risk === 'High' || flood.risk === 'Very High') ? 'flood-banner--high'
    : 'flood-banner--moderate';
  const floodIcon = (flood?.risk === 'High' || flood?.risk === 'Very High') ? '⚠️' : (flood?.zone === 'X' ? '🛡️' : '🌊');

  const floodBannerHTML = `
  <div class="prem-flood-zone-banner">
    <div class="prem-flood-zone-inner ${bannerClass}">
      <div class="prem-flood-zone-icon">${floodIcon}</div>
      <div>
        <div class="prem-flood-zone-label">FEMA Flood Zone — Parcel Level</div>
        <div class="prem-flood-zone-name">Zone ${flood ? escapeHtml(flood.zone) : 'Unknown'} — ${flood ? escapeHtml(flood.risk) : 'Data Unavailable'} Risk</div>
        <div class="prem-flood-zone-desc">${(floodPara || '').split('.')[0]}.</div>
      </div>
    </div>
  </div>`;

  const leftHTML = `
    ${tornadoHTML}
    <div class="prem-narrative">
      <p class="prem-narrative-lead">${floodPara}</p>
      ${femaCountHTML}
      ${watershedHTML}
    </div>
    <div class="prem-safety-actions">
      <div class="prem-safety-actions-label">4 Things to Verify Before You Close</div>
      ${actionsHTML}
    </div>
    <div class="key-takeaway">
      <span class="kt-icon">🔑</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${takeaway}</div>
    </div>
    <p class="prem-disclaimer">Flood zone: FEMA National Flood Hazard Layer, parcel-level. Tornado frequency: NOAA Storm Events Database historical averages by state. Insurance cost estimates: NFIP rate ranges, 2024. Research date: ${today}. Verify all data directly with FEMA and your insurance agent before closing.</p>`;

  const cloudSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:80" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" style="--path-len:80"/></svg>`;
  const glanceHTML = buildClimateGlanceHTML(environment, climateHistory);

  const deepDiveHTML = buildClimateDeepDiveHTML(climateHistory, locationInfo);
  const researchDataHTML = buildClimateResearchHTML(climateHistory);

  const fullHTML = [
    deepDiveHTML    ? `<div class="depth-l3">${floodBannerHTML}${deepDiveHTML}</div>` : (floodBannerHTML ? `<div class="depth-l3">${floodBannerHTML}</div>` : ''),
    researchDataHTML ? `<div class="depth-l4">${researchDataHTML}</div>` : '',
  ].filter(Boolean).join('');

  return renderChapterCard('climate', '09', cloudSvg, 'Climate & Weather Risks', 'The risks that come with the address, not just the house.', null, leftHTML, null, fullHTML || null, null, glanceHTML || null);
}

// ── Level 3: Deep Read — 6 tabs ───────────────────────────────────────────────

function buildClimateDeepDiveHTML(climateHistory, locationInfo) {
  if (!climateHistory) return '';
  const { stormEvents, femaDeclarations, climateNormals, preparedness, basementContext, watershed } = climateHistory;
  const county = locationInfo?.county || 'this county';

  const tabs = [
    { id: 'flood',    label: 'Flood History',         content: buildFloodTab(stormEvents.floods, femaDeclarations, county, watershed?.named) },
    { id: 'tornado',  label: 'Tornado History',        content: buildTornadoTab(stormEvents.tornadoes, basementContext, preparedness?.emergencySystem) },
    { id: 'winter',   label: 'Winter Weather',         content: buildWinterTab(stormEvents.winterStorms, climateNormals, preparedness?.roadPriority) },
    { id: 'heat',     label: 'Heat &amp; Drought',     content: buildHeatTab(stormEvents.heatEvents, climateNormals) },
    { id: 'prepared', label: 'Community Preparedness', content: buildPreparednessTab(preparedness, county) },
    { id: 'calendar', label: 'Month by Month',         content: buildClimateCalendarTab(climateNormals, stormEvents) },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0}" aria-controls="ctab-${t.id}" id="cbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="ctab-${t.id}" role="tabpanel" aria-labelledby="cbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="climate-deep-dive">
      <div class="climate-deep-dive-label">Weather History &amp; Preparedness</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Climate deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}

function buildFloodTab(floods, femaDeclarations, county, namedWatershed) {
  const rarityStmt = _computeRarityStatement(floods.length, CLIMATE_STORM_LOOKBACK_YEARS, 'flood');
  const femaItems = (femaDeclarations?.weatherRelated || []).slice(0, 10).map((d) => {
    const year = d.declarationDate ? new Date(d.declarationDate).getFullYear() : '?';
    return `<div class="climate-event-row"><span class="climate-event-year">${year}</span><span class="climate-event-desc">${escapeHtml(d.declarationTitle || d.incidentType || 'Declaration')}</span></div>`;
  }).join('');

  const floodItems = (floods || []).slice(0, 5).map((e) => {
    const year = e.begin_date ? new Date(e.begin_date).getFullYear() : '?';
    const dmg = e.damage_property ? ` — $${Number(e.damage_property).toLocaleString()} in property damage` : '';
    return `<div class="climate-event-row"><span class="climate-event-year">${year}</span><span class="climate-event-desc">${escapeHtml(e.event_type || 'Flood')}${dmg}</span></div>`;
  }).join('');

  const watershedGroup = namedWatershed?.huc12Name
    ? `<div class="climate-event-group">
        <div class="climate-event-group-label">Your Watershed</div>
        <p class="prem-narrative-body">This home sits in the <strong>${escapeHtml(namedWatershed.huc12Name).replace(/-/g, '&ndash;')}</strong> watershed.</p>
      </div>`
    : '';

  return `
    <p class="prem-narrative-body">${escapeHtml(rarityStmt)} The question isn't whether it will happen — it's whether this specific property drains well enough to avoid it.</p>
    ${watershedGroup}
    ${femaItems ? `<div class="climate-event-group"><div class="climate-event-group-label">Federal Disaster Declarations</div>${femaItems}</div>` : ''}
    ${floodItems ? `<div class="climate-event-group"><div class="climate-event-group-label">Significant Flood Events</div>${floodItems}</div>` : ''}
    <div class="climate-event-group">
      <div class="climate-event-group-label">Ask the Seller</div>
      <p class="prem-narrative-body">Has water ever entered the basement, crawlspace, or garage? Have neighboring properties experienced yard flooding during heavy rain? These questions aren't on any standard inspection checklist.</p>
    </div>
    <p class="prem-disclaimer">Source: NOAA Storm Events Database, FEMA OpenFEMA. ${escapeHtml(county)}, last ${CLIMATE_STORM_LOOKBACK_YEARS} years.</p>`;
}

function buildTornadoTab(tornadoes, basementContext, emergencySystem) {
  const rarityStmt = _computeRarityStatement((tornadoes || []).length, CLIMATE_STORM_LOOKBACK_YEARS, 'tornado');

  const tornadoItems = (tornadoes || []).slice(0, 8).map((e) => {
    const year = e.begin_date ? new Date(e.begin_date).getFullYear() : '?';
    const ef = e.magnitude != null ? `EF${e.magnitude}` : 'EF unknown';
    const inj = e.injuries_direct > 0 ? ` · ${e.injuries_direct} injuries` : '';
    const dead = e.deaths_direct > 0 ? ` · ${e.deaths_direct} deaths` : '';
    return `<div class="climate-event-row"><span class="climate-event-year">${year}</span><span class="climate-event-desc">${ef}${inj}${dead}</span></div>`;
  }).join('');

  const basementHTML = basementContext
    ? `<div class="climate-event-group"><div class="climate-event-group-label">Basement &amp; Shelter</div><p class="prem-narrative-body">${escapeHtml(basementContext)}</p></div>`
    : '';

  const sys = emergencySystem;
  const alertHTML = sys
    ? `<p class="prem-narrative-body">Register for <strong>${escapeHtml(sys.name || 'local emergency alerts')}</strong> — warnings arrive 2–3 minutes faster on your phone than outdoor sirens. <a href="${escapeHtml(sys.url)}" target="_blank" rel="noopener">Register here</a>.</p>`
    : '';

  return `
    <p class="prem-narrative-body">${escapeHtml(rarityStmt)}</p>
    ${tornadoItems ? `<div class="climate-event-group"><div class="climate-event-group-label">Tornado Events</div>${tornadoItems}</div>` : ''}
    ${basementHTML}
    ${alertHTML}
    <p class="prem-disclaimer">Source: NOAA Storm Events Database. Last ${CLIMATE_STORM_LOOKBACK_YEARS} years.</p>`;
}

function buildWinterTab(winterStorms, normals, roadPriority) {
  const daysBelow32 = normals?.annual?.daysBelow32 ?? null;
  const profileHTML = daysBelow32 !== null
    ? `<div class="climate-event-group"><div class="climate-event-group-label">Average Winter Profile</div><p class="prem-narrative-body">Average days below 32°F: <strong>${daysBelow32}</strong></p></div>`
    : '';

  const stormItems = (winterStorms || []).slice(0, 5).map((e) => {
    const year = e.begin_date ? new Date(e.begin_date).getFullYear() : '?';
    return `<div class="climate-event-row"><span class="climate-event-year">${year}</span><span class="climate-event-desc">${escapeHtml(e.event_type || 'Winter event')}</span></div>`;
  }).join('');

  const roadMap = {
    primary: 'This address is on a primary road — typically cleared within 4–6 hours of significant snow.',
    secondary: 'This address is on a secondary road — typically cleared within 12–24 hours after primary roads.',
    residential: 'This address is on a residential street — typically cleared within 24–48 hours. Plan for potential access limitations after significant snow.',
  };
  const roadHTML = roadPriority && roadMap[roadPriority]
    ? `<div class="climate-event-group"><div class="climate-event-group-label">Road Priority</div><p class="prem-narrative-body">${roadMap[roadPriority]}</p></div>`
    : '';

  return `
    ${profileHTML}
    ${stormItems ? `<div class="climate-event-group"><div class="climate-event-group-label">Significant Winter Events</div>${stormItems}</div>` : ''}
    ${roadHTML}
    <p class="prem-narrative-body">Three actions: register for emergency alerts before move-in, know your road priority tier, stock a 72-hour power outage kit before your first winter.</p>
    <p class="prem-disclaimer">Source: NOAA Storm Events Database, NOAA Climate Normals.</p>`;
}

function buildHeatTab(heatEvents, normals) {
  const above90 = normals?.annual?.daysAbove90 ?? null;
  const above95 = normals?.annual?.daysAbove95 ?? null;

  const profileHTML = above90 !== null ? `
    <div class="climate-event-group">
      <div class="climate-event-group-label">Average Heat Profile</div>
      <p class="prem-narrative-body">Days above 90°F per year: <strong>${above90}</strong></p>
      ${above95 !== null ? `<p class="prem-narrative-body">Days above 95°F per year: <strong>${above95}</strong></p>` : ''}
    </div>` : '';

  const heatItems = (heatEvents || []).slice(0, 5).map((e) => {
    const year = e.begin_date ? new Date(e.begin_date).getFullYear() : '?';
    return `<div class="climate-event-row"><span class="climate-event-year">${year}</span><span class="climate-event-desc">${escapeHtml(e.event_type || 'Heat event')}</span></div>`;
  }).join('');

  return `
    ${profileHTML}
    ${heatItems ? `<div class="climate-event-group"><div class="climate-event-group-label">Heat &amp; Drought Events</div>${heatItems}</div>` : ''}
    <p class="prem-narrative-body">Service the HVAC before your first summer — $80–$150 and prevents the most common cause of cooling failure.</p>
    <p class="prem-disclaimer">Source: NOAA Climate Normals, NOAA Storm Events Database.</p>`;
}

function buildPreparednessTab(preparedness, county) {
  const sys = preparedness?.emergencySystem;
  const sysHTML = sys ? `
    <div class="climate-event-group">
      <div class="climate-event-group-label">Emergency Alert System</div>
      ${sys.tier === 1
        ? `<p class="prem-narrative-body"><strong>${escapeHtml(sys.name)}</strong> is the official alert system for this area. <a href="${escapeHtml(sys.url)}" target="_blank" rel="noopener">Register here</a> before move-in.</p>`
        : `<p class="prem-narrative-body">Emergency alerts for ${escapeHtml(county)} are managed locally. <a href="${escapeHtml(sys.url)}" target="_blank" rel="noopener">Try this URL</a> or <a href="${escapeHtml(sys.searchUrl)}" target="_blank" rel="noopener">search for the registration page</a>.</p>`
      }
    </div>` : '';

  const roadMap = {
    primary: 'Primary arterial — first priority for snow/ice clearing.',
    secondary: 'Secondary road — cleared after primary arterials.',
    residential: 'Residential street — last priority. Plan for potential 24–48 hour delays.',
  };
  const roadHTML = preparedness?.roadPriority && roadMap[preparedness.roadPriority]
    ? `<div class="climate-event-group"><div class="climate-event-group-label">Road Priority</div><p class="prem-narrative-body">${roadMap[preparedness.roadPriority]}</p></div>`
    : '';

  return `
    ${sysHTML}
    ${roadHTML}
    <div class="climate-event-group">
      <div class="climate-event-group-label">72-Hour Kit</div>
      <p class="prem-narrative-body">Water (1 gallon/person/day), 3-day food supply, battery-powered weather radio, flashlights, first aid kit, phone battery bank. For winter ice storm risk: add blankets, hand warmers, and a plan for extended power outage.</p>
    </div>`;
}

function buildClimateCalendarTab(normals, stormEvents) {
  const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const eventsByMonth = {};
  for (const e of (stormEvents?.allEvents || [])) {
    const d = new Date(e.begin_date);
    if (!isNaN(d.getTime())) {
      const m = d.getMonth();
      if (!eventsByMonth[m]) eventsByMonth[m] = [];
      eventsByMonth[m].push(e);
    }
  }

  const rows = MONTHS.map((name, i) => {
    const mn = normals?.monthly?.[i];
    const tempNote = mn?.tMaxF != null ? `Avg high: ${Math.round(mn.tMaxF)}°F.` : '';
    const evts = (eventsByMonth[i] || []);
    const top = evts.sort((a, b) => (b.damage_property || 0) - (a.damage_property || 0))[0];
    const evtNote = top ? ` Notable: ${new Date(top.begin_date).getFullYear()} ${top.event_type}.` : '';
    return `<div class="climate-cal-month"><div class="climate-cal-month-name">${name}</div><div class="climate-cal-month-body">${(tempNote + evtNote).trim() || 'No notable events recorded.'}</div></div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">Month-by-month profile based on ${CLIMATE_STORM_LOOKBACK_YEARS} years of county storm data and 30-year climate normals.</p>
    <div class="climate-calendar">${rows}</div>
    <p class="prem-disclaimer">Source: NOAA Storm Events Database, NOAA Climate Normals.</p>`;
}

// ── Level 4: Watershed Context ────────────────────────────────────────────────

function buildWatershedContextHTML(watershed) {
  const named = watershed?.named;
  if (!named?.huc12Name) return '';
  const name = escapeHtml(named.huc12Name).replace(/-/g, '&ndash;');
  const basinClause = named.basinName
    ? ` This home's watershed — <strong>${name}</strong> — is part of the larger <strong>${escapeHtml(named.basinName).replace(/-/g, '&ndash;')}</strong> basin.`
    : ` This home's watershed is <strong>${name}</strong>.`;

  let tieBack = '';
  if (watershed.topographicPosition === 'lowpoint') {
    tieBack = ' Combined with the parcel\'s low-lying position noted above, runoff from uphill in this same basin moves toward and past this property — which is why local drainage, not just the FEMA zone, governs how this lot handles heavy rain.';
  } else if (watershed.topographicPosition === 'uphill') {
    tieBack = ' With the parcel sitting above the surrounding terrain, runoff tends to drain away from the home rather than toward it.';
  }

  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Watershed Context</div>
      <p class="prem-narrative-body">A watershed is the area of land where all rainfall drains to a common point.${basinClause}${tieBack}</p>
      <p class="prem-disclaimer">Source: USGS Watershed Boundary Dataset (HUC-12 / HUC-8).</p>
    </div>`;
}

// ── Level 4: Research — full data tables ──────────────────────────────────────

function buildClimateResearchHTML(climateHistory) {
  if (!climateHistory) return '';
  const { stormEvents, climateNormals, watershed } = climateHistory;

  const watershedHTML = buildWatershedContextHTML(watershed);

  const eventRows = (stormEvents?.allEvents || [])
    .sort((a, b) => new Date(b.begin_date) - new Date(a.begin_date))
    .map((e) => {
      const dmg = e.damage_property ? `$${Number(e.damage_property).toLocaleString()}` : '—';
      const ef  = e.magnitude != null ? `EF${e.magnitude}` : '—';
      return `<tr>
        <td>${escapeHtml(e.begin_date?.slice(0, 10) || '?')}</td>
        <td>${escapeHtml(e.event_type || '?')}</td>
        <td>${ef}</td>
        <td>${e.deaths_direct ?? 0}</td>
        <td>${e.injuries_direct ?? 0}</td>
        <td>${dmg}</td>
      </tr>`;
    }).join('');

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const normalRows = (climateNormals?.monthly || []).map((m) =>
    `<tr>
      <td>${MONTH_NAMES[m.month - 1]}</td>
      <td>${m.tMaxF !== null ? Math.round(m.tMaxF) + '°F' : '—'}</td>
      <td>${m.tMinF !== null ? Math.round(m.tMinF) + '°F' : '—'}</td>
      <td>${m.precipIn !== null ? m.precipIn + '"' : '—'}</td>
      <td>${m.snowIn !== null ? m.snowIn + '"' : '—'}</td>
    </tr>`
  ).join('');

  if (!eventRows && !normalRows && !watershedHTML) return '';

  return `
    ${watershedHTML}
    ${eventRows ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Complete Storm Event Log (${CLIMATE_STORM_LOOKBACK_YEARS} years)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Date</th><th>Event</th><th>Magnitude</th><th>Deaths</th><th>Injuries</th><th>Property Damage</th></tr></thead>
          <tbody>${eventRows}</tbody>
        </table>
      </div>
    </div>` : ''}
    ${normalRows ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">30-Year Monthly Climate Normals${climateNormals?.stationName ? ' — ' + escapeHtml(climateNormals.stationName) : ''}</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Month</th><th>Avg High</th><th>Avg Low</th><th>Precip</th><th>Snowfall</th></tr></thead>
          <tbody>${normalRows}</tbody>
        </table>
      </div>
    </div>` : ''}
    ${(eventRows || normalRows) ? '<p class="prem-disclaimer">Source: NOAA Storm Events Database, NOAA Climate Normals.</p>' : ''}`;
}

// getTornadoTier is needed here — imported from chapters.js indirectly via the caller.
// For now, callers pass locationInfo which has already been processed — the tornado tier
// is computed in chapters.js before calling this function. This function receives `environment`
// which already includes the tornado context via the caller chain.
function getTornadoTier(state) {
  const { TORNADO_TIER } = require('../../utils/constants');
  if (TORNADO_TIER.high.includes(state))     return { tier: 'High',     color: 'orange', note: `${state} averages among the highest tornado frequency in the US. Verify home has an interior shelter or basement.` };
  if (TORNADO_TIER.moderate.includes(state)) return { tier: 'Moderate', color: 'gold',   note: `${state} sees periodic tornado activity. Most homes here are built with standard storm shutters — ask about storm shelter access.` };
  if (TORNADO_TIER.low.includes(state))      return { tier: 'Low',      color: 'green',  note: `${state} has low historical tornado frequency.` };
  return                                            { tier: 'Unknown',  color: 'muted',  note: 'Check NOAA Storm Events for this area.' };
}

module.exports = { buildClimateChapterHTML };
