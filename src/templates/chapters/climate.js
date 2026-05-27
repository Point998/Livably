'use strict';
const { escapeHtml } = require('../../utils/text');
const { badgeClass } = require('../components/badge');
const { renderChapterCard } = require('../components/chapterCard');

function buildClimateChapterHTML(environment, locationInfo) {
  if (!environment) return '';
  const flood  = environment.floodRisk;
  const state  = locationInfo?.state || null;
  const county = locationInfo?.county || 'this county';
  const tornado = state ? getTornadoTier(state) : null;

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
  return renderChapterCard('climate', '09', cloudSvg, 'Climate & Weather Risks', 'The risks that come with the address, not just the house.', null, leftHTML, null, floodBannerHTML, null);
}

// getTornadoTier is needed here — imported from premium.js indirectly via the caller.
// For now, callers pass locationInfo which has already been processed — the tornado tier
// is computed in premium.js before calling this function. This function receives `environment`
// which already includes the tornado context via the caller chain.
// TODO (FR-041): move getTornadoTier to shared/constants or utils when reportBuilder is built.
function getTornadoTier(state) {
  const { TORNADO_TIER } = require('../../utils/constants');
  if (TORNADO_TIER.high.includes(state))     return { tier: 'High',     color: 'orange', note: `${state} averages among the highest tornado frequency in the US. Verify home has an interior shelter or basement.` };
  if (TORNADO_TIER.moderate.includes(state)) return { tier: 'Moderate', color: 'gold',   note: `${state} sees periodic tornado activity. Most homes here are built with standard storm shutters — ask about storm shelter access.` };
  if (TORNADO_TIER.low.includes(state))      return { tier: 'Low',      color: 'green',  note: `${state} has low historical tornado frequency.` };
  return                                            { tier: 'Unknown',  color: 'muted',  note: 'Check NOAA Storm Events for this area.' };
}

module.exports = { buildClimateChapterHTML };
