'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderChapterCard } = require('../components/chapterCard');

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
  return renderChapterCard('growth', '08', craneSvg, 'Growth &amp; Development', 'What\'s being built around you — and what to watch for.', null, body, null, null, null, glanceHTML || null);
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
