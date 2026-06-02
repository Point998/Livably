'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderChapterCard } = require('../../templates/components/chapterCard');

function buildGrowthPermitTrendsTab(permits, newConstruction, locationInfo) {
  const county = locationInfo?.county || 'this county';

  if (permits) {
    const { current, currentYear, priorYear, trend, percentChange } = permits;
    const trendClass  = trend === 'rising' ? 'growth-permit-trend-up'
                      : trend === 'declining' ? 'growth-permit-trend-down'
                      : 'growth-permit-trend-flat';
    const trendSymbol = trend === 'rising' ? '▲' : trend === 'declining' ? '▼' : '—';
    const trendLabel  = trend === 'rising'    ? `+${Math.abs(percentChange)}% from ${priorYear || 'prior year'}`
                      : trend === 'declining' ? `${percentChange}% from ${priorYear || 'prior year'}`
                      : `Stable vs ${priorYear || 'prior year'}`;
    const context = trend === 'rising'
      ? `Rising permit activity in ${escapeHtml(county)} signals active investment in the area — new housing, commercial expansion, and infrastructure improvements tend to follow sustained growth.`
      : trend === 'declining'
      ? `Declining permit activity in ${escapeHtml(county)} may reflect a maturing market, rising construction costs, or broader economic conditions. Ask your agent what's driving the slowdown.`
      : `Stable permit activity in ${escapeHtml(county)} reflects a steady market — neither a boom nor a contraction.`;

    return `
      <div class="growth-permit-stat-row">
        <div class="growth-permit-stat">
          <div class="growth-permit-stat-label">${currentYear || 'Current year'}</div>
          <div class="growth-permit-stat-val">${current.toLocaleString()}</div>
          <div class="growth-permit-stat-sub">building permits</div>
        </div>
        <div class="growth-permit-stat">
          <div class="growth-permit-stat-label">Year-over-year</div>
          <div class="growth-permit-stat-val ${trendClass}">${trendSymbol} ${trendLabel}</div>
          <div class="growth-permit-stat-sub">vs ${priorYear || 'prior year'}</div>
        </div>
      </div>
      <p class="prem-narrative-body">${context}</p>
      <p class="prem-disclaimer">Source: U.S. Census Bureau Building Permits Survey. County-level data — not neighborhood-specific.</p>`;
  }

  if (newConstruction) {
    const { newConstructionPct } = newConstruction;
    const context = newConstructionPct >= 20
      ? `${newConstructionPct}% of housing in this Census tract was built after 2010 — a high share of recent construction, indicating active growth area investment.`
      : newConstructionPct >= 10
      ? `About ${newConstructionPct}% of housing in this Census tract was built after 2010, reflecting moderate new construction activity.`
      : `Only ${newConstructionPct}% of housing in this Census tract was built after 2010, indicating an established neighborhood with limited recent development.`;

    return `
      <div class="growth-permit-stat-row">
        <div class="growth-permit-stat">
          <div class="growth-permit-stat-label">Post-2010 housing</div>
          <div class="growth-permit-stat-val">${newConstructionPct}%</div>
          <div class="growth-permit-stat-sub">of tract housing</div>
        </div>
      </div>
      <p class="prem-narrative-body">${context}</p>
      <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates. Census tract level.</p>`;
  }

  return `
    <p class="prem-narrative-body">Building permit trend data was not available for ${escapeHtml(county)} at this time.</p>
    <p class="prem-narrative-body">To get current permit activity, contact the ${escapeHtml(county)} Planning and Zoning office directly — they maintain a public database of all issued permits and can tell you what's been approved in the last 12 months.</p>`;
}

function buildGrowthResearchGuideTab(locationInfo) {
  const county = locationInfo?.county || 'your county';
  const city   = locationInfo?.city   || county;

  const items = [
    {
      icon: '🏛️',
      title: `${county} Planning & Zoning`,
      detail: `Search "${county} planning and zoning" to find the county planning department portal. Pending permit applications, approved zoning changes, and variance requests are all public record — but you have to ask.`,
    },
    {
      icon: '🗺️',
      title: 'GIS Zoning Map',
      detail: `Search "${county} GIS zoning map" or "${city} zoning map." These interactive maps show current zoning classifications and often have a layer for approved developments. Rezoning of adjacent parcels can significantly affect what gets built next door.`,
    },
    {
      icon: '🛣️',
      title: 'State DOT Road Projects',
      detail: `Road widening, new interchanges, and highway extensions are announced years in advance. Search "[state] DOT statewide transportation improvement program" (STIP) — it's a federally mandated list of funded projects with timelines.`,
    },
    {
      icon: '📰',
      title: 'Local news + planning meeting minutes',
      detail: `County planning commission minutes are public record and often the first place a major development surfaces before it reaches any database. Search "${city} planning commission minutes" to find recent agendas.`,
    },
  ];

  const rows = items.map(it => `
    <div class="safety-prep-item">
      <div class="safety-prep-item-hd">
        <span class="safety-prep-item-icon">${it.icon}</span>
        <span class="safety-prep-item-title">${escapeHtml(it.title)}</span>
      </div>
      <p class="safety-prep-item-detail">${escapeHtml(it.detail)}</p>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">The developments that most affect your quality of life — road widenings, large apartment complexes, commercial pads adjacent to your lot — live in planning databases that no API exposes. Here's how to find them.</p>
    ${rows}`;
}

function buildGrowthResearchHTML(growth) {
  if (!growth) return '';
  const { namedProjects = [], establishments = [] } = growth;

  const projectRows = namedProjects.map(p => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.type)}</td>
      <td>${escapeHtml(p.status)}</td>
      <td>${escapeHtml(p.expectedOpening || '—')}</td>
    </tr>`).join('');

  const projectsTable = projectRows ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Named Development Projects</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Project</th><th>Type</th><th>Status</th><th>Expected</th></tr></thead>
          <tbody>${projectRows}</tbody>
        </table>
      </div>
    </div>` : '';

  const establishmentRows = establishments.map(e => `
    <tr>
      <td>${escapeHtml(e.name)}</td>
      <td>${escapeHtml(e.label)}</td>
      <td>${e.distanceMiles.toFixed(1)} mi</td>
    </tr>`).join('');

  const establishmentsTable = establishmentRows ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Commercial Establishments Within 1.5 Miles</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Name</th><th>Category</th><th>Distance</th></tr></thead>
          <tbody>${establishmentRows}</tbody>
        </table>
      </div>
    </div>` : '';

  const content = [projectsTable, establishmentsTable].filter(Boolean).join('');
  return content || '';
}

function buildGrowthDeepDiveHTML(growth) {
  if (!growth) return '';
  const { permits, newConstruction, locationInfo } = growth;

  const tabs = [
    { id: 'permits',  label: 'Permit Trends',  content: buildGrowthPermitTrendsTab(permits, newConstruction, locationInfo) },
    { id: 'research', label: 'Research Guide', content: buildGrowthResearchGuideTab(locationInfo) },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="grtab-${t.id}" id="grbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="grtab-${t.id}" role="tabpanel" aria-labelledby="grbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="growth-deep-dive">
      <div class="growth-deep-dive-label">Growth in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Growth chapter deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}

function buildGrowthAndDevelopmentHTML(growth) {
  if (!growth) return '';
  const { permits, newConstruction, establishments, namedProjects = [], locationInfo } = growth;
  const county = locationInfo?.county || 'this county';
  const city   = locationInfo?.city   || '';

  // ── Named projects (from local intel database) ────────────────────────────
  const STATUS_CLASSES = {
    'Under Construction': 'project-status--construction',
    'Approved':           'project-status--approved',
    'Planned':            'project-status--planned',
  };

  const hasManual    = namedProjects.some((p) => !p.automated);
  const hasAutomated = namedProjects.some((p) => p.automated);
  const sectionLabel = hasManual
    ? `Confirmed Projects Near ${escapeHtml(city || county)}`
    : `Developments Reported Near ${escapeHtml(city || county)}`;

  let namedProjectsHTML = '';
  if (namedProjects.length) {
    const projectCards = namedProjects.map((p) => {
      const statusClass = STATUS_CLASSES[p.status] || 'project-status--default';
      return `
        <div class="prem-growth-named-project">
          <div class="prem-growth-named-project-header">
            <span class="prem-growth-named-project-icon">${p.icon}</span>
            <div class="prem-growth-named-project-title">
              <div class="prem-growth-named-project-name">${escapeHtml(p.name)}</div>
              <div class="prem-growth-named-project-type">${escapeHtml(p.type)}</div>
            </div>
            <div class="prem-growth-named-project-status ${statusClass}">${escapeHtml(p.status)}</div>
          </div>
          ${p.expectedOpening ? `<div class="prem-growth-named-project-timeline">Expected: ${escapeHtml(p.expectedOpening)}</div>` : ''}
          <div class="prem-growth-named-project-impact">${escapeHtml(p.impact)}</div>
          ${p.automated ? `<div class="prem-growth-named-project-source">Source: ${escapeHtml(p.source || 'News report')}${p.sourceUrl ? ` · <a href="${escapeHtml(p.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="prem-growth-source-link">view article</a>` : ''}</div>` : ''}
        </div>`;
    }).join('');

    const automatedNote = hasAutomated && !hasManual
      ? `<div class="prem-growth-automated-note">Projects discovered via news search — verify with ${escapeHtml(county)} Planning &amp; Zoning before making decisions.</div>`
      : '';

    namedProjectsHTML = `
      <div class="prem-growth-section prem-growth-named-projects">
        <div class="prem-growth-label">${sectionLabel}</div>
        ${projectCards}
        ${automatedNote}
      </div>`;
  }

  // ── Growth trend narrative ────────────────────────────────────────────────
  let growthPara;
  if (permits) {
    const countStr = permits.current.toLocaleString();
    const yearStr  = permits.currentYear ? ` in ${permits.currentYear}` : '';
    const trendCtx =
      permits.trend === 'rising'    ? `up ${Math.abs(permits.percentChange)}% from ${permits.priorYear || 'the prior year'}` :
      permits.trend === 'declining' ? `down ${Math.abs(permits.percentChange)}% from ${permits.priorYear || 'the prior year'}` :
      `relatively stable compared to ${permits.priorYear || 'the prior year'}`;
    const trendDesc =
      permits.trend === 'rising'
        ? `That's an active construction pace — new housing and commercial development are expanding in this area.`
        : permits.trend === 'declining'
        ? `Construction has slowed from recent levels. That can reflect a maturing market or broader economic conditions.`
        : `Construction activity is holding steady — neither a boom nor a slowdown.`;
    growthPara = `${escapeHtml(county)} issued ${countStr} building permits${yearStr}, ${trendCtx}. ${trendDesc}`;
  } else if (newConstruction) {
    const pct = newConstruction.newConstructionPct;
    if (pct >= 20)      growthPara = `${pct}% of housing in this Census tract was built after 2010 — a significant share of relatively recent construction, indicating an active growth area.`;
    else if (pct >= 10) growthPara = `About ${pct}% of housing in this Census tract was built after 2010, reflecting moderate new construction activity in the area.`;
    else                growthPara = `Only ${pct}% of housing in this Census tract was built after 2010, indicating an established neighborhood with limited recent new construction.`;
  } else {
    growthPara = `Building permit trend data was not available for ${escapeHtml(county)} at this time. For current construction activity, contact the ${escapeHtml(county)} Planning and Zoning office directly.`;
  }

  // ── Commercial landscape ──────────────────────────────────────────────────
  let activityPara = '';
  let placesHTML   = '';
  if (establishments?.length) {
    const nearby     = establishments.filter((e) => e.distanceMiles <= 0.5);
    const withinMile = establishments.filter((e) => e.distanceMiles > 0.5 && e.distanceMiles <= 1);
    if (nearby.length) {
      activityPara = `Within a half mile: ${nearby.slice(0, 3).map((e) => escapeHtml(e.name)).join(', ')}. The commercial environment immediately surrounding this address is active and established.`;
    } else if (withinMile.length) {
      activityPara = `Within a mile: ${withinMile.slice(0, 3).map((e) => escapeHtml(e.name)).join(', ')}. The local commercial corridor is accessible without a long drive.`;
    } else {
      const e = establishments[0];
      activityPara = `The nearest major commercial establishment is ${escapeHtml(e.name)} (${e.distanceMiles.toFixed(1)} mi). Commercial density in the immediate area is lower.`;
    }
    placesHTML = `
      <div class="prem-growth-section">
        <div class="prem-growth-label">Commercial Landscape Within 1.5 Miles</div>
        <div class="prem-growth-places">
          ${establishments.map((e) => `
          <div class="prem-growth-place">
            <span class="prem-growth-place-icon">${e.icon}</span>
            <div class="prem-growth-place-info">
              <div class="prem-growth-place-name">${escapeHtml(e.name)}</div>
              <div class="prem-growth-place-cat">${escapeHtml(e.label)}</div>
            </div>
            <div class="prem-growth-place-dist">${e.distanceMiles.toFixed(1)} mi</div>
          </div>`).join('')}
        </div>
      </div>`;
  }

  // ── Pipeline note ─────────────────────────────────────────────────────────
  const planningPara = `For development projects in the pipeline — approved applications, zoning changes, pending permits — check with ${escapeHtml(county)} Planning and Zoning. Those records are public but require a direct inquiry. Specific projects (a proposed apartment complex, a road widening, a new commercial pad) won't show up in any API; they live in the county's planning portal.`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeaway;
  if (namedProjects.length) {
    const underConstruction = namedProjects.filter((p) => p.status === 'Under Construction');
    const approved          = namedProjects.filter((p) => p.status === 'Approved');
    if (underConstruction.length) {
      takeaway = `${escapeHtml(underConstruction[0].name)} is currently under construction${underConstruction[0].timeline ? ` (expected ${escapeHtml(underConstruction[0].timeline)})` : ''} — a significant change coming to this area within the next year or two.`;
    } else if (approved.length) {
      takeaway = `${escapeHtml(approved[0].name)} has been approved${approved[0].timeline ? ` (expected ${escapeHtml(approved[0].timeline)})` : ''} — this development is confirmed and on the way.`;
    } else {
      takeaway = `${namedProjects.length} confirmed development project${namedProjects.length > 1 ? 's are' : ' is'} on the way near this address. See details above.`;
    }
  } else if (permits?.trend === 'rising' && permits.percentChange >= 20) {
    takeaway = `${escapeHtml(county)} is in an active growth phase — building permits are up ${permits.percentChange}% year-over-year. Expect continued residential and commercial expansion near this area.`;
  } else if (permits?.trend === 'declining' && permits.percentChange !== null && permits.percentChange <= -20) {
    takeaway = `Construction activity in ${escapeHtml(county)} has slowed significantly (${permits.percentChange}%). Ask your agent about what's driving the change.`;
  } else if (establishments?.length && establishments.filter((e) => e.distanceMiles <= 0.5).length >= 2) {
    takeaway = `The immediate area has active commercial infrastructure within a half mile. For specific planned projects near this address, contact ${escapeHtml(county)} Planning and Zoning directly.`;
  } else {
    takeaway = `For the most current picture of planned development near this address, contact ${escapeHtml(county)} Planning and Zoning — their records show pending applications and approved projects that don't yet appear in any public data feed.`;
  }

  const sources = [];
  if (namedProjects.length) sources.push('Livably Development Intelligence (manually verified)');
  if (permits) sources.push('U.S. Census Bureau Building Permits Survey');
  else if (newConstruction) sources.push('U.S. Census ACS 5-year estimates');
  if (establishments?.length) sources.push('Google Places');
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const body = `
    ${namedProjectsHTML}
    <div class="prem-narrative">
      <p class="prem-narrative-lead">${growthPara}</p>
      ${activityPara ? `<p class="prem-narrative-body">${activityPara}</p>` : ''}
      <p class="prem-narrative-body">${planningPara}</p>
    </div>
    ${placesHTML}
    <div class="key-takeaway">
      <span class="kt-icon">🔑</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${takeaway}</div>
    </div>
    <p class="prem-disclaimer">Sources: ${escapeHtml(sources.join('; ') || 'See notes above')}. Research date: ${today}. Permit data is county-level — not neighborhood-specific. Specific planned projects require direct inquiry with the county planning department.</p>`;

  const craneSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="14" width="6" height="8"/><rect x="9" y="10" width="6" height="12"/><rect x="16" y="6" width="6" height="16"/><line x1="2" y1="22" x2="22" y2="22"/></svg>`;
  const glanceHTML = buildGrowthGlanceHTML(growth);
  const deepDiveHTML = buildGrowthDeepDiveHTML(growth);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
  const researchHTML = buildGrowthResearchHTML(growth);
  const l4HTML = researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '';
  const fullHTML = [l3HTML, l4HTML].filter(Boolean).join('');
  return renderChapterCard('growth', '08', craneSvg, 'Growth &amp; Development', 'What\'s being built around you — and what to watch for.', null, body, null, fullHTML || null, null, glanceHTML || null);
}

function buildGrowthGlanceHTML(growth) {
  if (!growth) return '';
  const named = growth.namedProjects || [];
  const text = named.length > 0
    ? named.slice(0, 2).map((p) => escapeHtml(p.name || p.project || p.title || String(p))).join(', ')
    : 'No confirmed development projects nearby';
  return `<div class="chapter-glance"><span class="chapter-glance-item">${text}</span></div>`;
}

module.exports = { buildGrowthAndDevelopmentHTML, buildGrowthGlanceHTML };
