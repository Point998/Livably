'use strict';
const { escapeHtml } = require('../../utils/text');
const { badgeClass, renderChapterCard } = require('../../templates/components');

function buildPropertyIntelligenceHTML(propIntel) {
  if (!propIntel) return '';
  const { soil, broadband, era, locationInfo } = propIntel;
  const county = locationInfo?.county || 'this county';

  // ── Construction Era ──────────────────────────────────────────────────────
  let eraPara;
  let eraCautionsHTML = '';
  if (era?.medianYearBuilt) {
    const ctx = era.context;
    eraPara = ctx
      ? `${escapeHtml(ctx.era)}. The median year built for homes in this Census tract is ${era.medianYearBuilt}${era.newConstructionPct !== undefined ? `, with ${era.newConstructionPct}% of housing built after 2010` : ''}.`
      : `The median year built for homes in this Census tract is ${era.medianYearBuilt}.`;
    if (ctx?.cautions?.length) {
      eraCautionsHTML = `
        <div class="prem-intel-cautions">
          <div class="prem-intel-caution-label">Inspection checklist for homes built in this era:</div>
          <ul class="prem-intel-caution-list">
            ${ctx.cautions.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}
          </ul>
        </div>`;
    }
  } else {
    eraPara = 'Construction era data was not available for this Census tract.';
  }

  // ── Soil & Drainage ───────────────────────────────────────────────────────
  let soilPara;
  let soilBadgeHTML = '';
  if (!soil) {
    soilPara = 'Soil survey data was not available for this location through the USDA Web Soil Survey.';
  } else {
    const name  = soil.muname || 'this soil type';
    const drain = soil.drainageCategory;
    const isUrban = !drain && (name.toLowerCase().includes('urban') || name.toLowerCase().includes('pits'));
    if (isUrban) {
      soilPara = `This address is on developed urban land — standard soil survey data isn't available for this parcel. For drainage and foundation soil information, request a geotechnical report or ask the seller about any known drainage issues.`;
    } else {
      soilPara = `The lot sits on ${escapeHtml(name)}${soil.drainagecl ? `, USDA drainage class: ${escapeHtml(soil.drainagecl.toLowerCase())}` : ''}. `;
      if (drain) {
        soilPara += escapeHtml(drain.implication);
        soilBadgeHTML = `<span class="prem-badge prem-intel-soil-badge ${badgeClass(drain.color)}">${escapeHtml(drain.label)}</span>`;
      } else if (!soil.drainagecl) {
        soilPara += `No drainage classification is on record for this soil type — consult a soil engineer for site-specific drainage evaluation.`;
      }
      if (soil.isHydric) {
        soilPara += ` USDA identifies this soil as hydric — a potential wetland indicator. Discuss foundation moisture, drainage feasibility, and any planned additions with your inspector.`;
      }
    }
  }

  // ── Broadband ─────────────────────────────────────────────────────────────
  let broadbandPara;
  let broadbandCardsHTML = '';
  if (!broadband || !broadband.providers?.length) {
    broadbandPara = broadband === null
      ? 'FCC broadband availability data was not accessible for this address. Verify internet service before closing: check the <a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noopener">FCC National Broadband Map</a> by searching this address, or search "[zip code] internet providers" for local ISP options.'
      : 'No internet providers were confirmed at this address through the FCC Broadband Map. Verify connectivity directly with local providers before closing.';
  } else {
    const cat = broadband.category;
    broadbandPara = cat.desc;
    if (broadband.maxDownloadMbps > 0) broadbandPara += ` Maximum advertised download: ${broadband.maxDownloadMbps} Mbps.`;
    broadbandPara += broadband.providers.length > 1
      ? ` ${broadband.providers.length} providers serve this address — competition gives you options if service quality is inconsistent.`
      : ` Only one provider is confirmed at this address — worth verifying service reliability before committing.`;
    broadbandCardsHTML = `
      <div class="prem-intel-bb-providers">
        <span class="prem-badge ${badgeClass(cat.color)}">${escapeHtml(cat.label)}</span>
        ${broadband.providers.map((p) => `
        <div class="prem-intel-bb-provider">
          <span class="prem-intel-bb-name">${escapeHtml(p.name)}</span>
          <span class="prem-intel-bb-tech">${escapeHtml(p.tech)}</span>
          ${p.download ? `<span class="prem-intel-bb-speed">${p.download} Mbps</span>` : ''}
        </div>`).join('')}
      </div>`;
  }

  // ── Tax & Permit note ─────────────────────────────────────────────────────
  const assessorSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${county} county assessor property records`)}`;
  const taxPermitPara = `Property tax history and permit records for this specific parcel are public records available from the <a href="${assessorSearchUrl}" target="_blank" rel="noopener">${escapeHtml(county)} Assessor</a> and Building Department. One call before closing reveals the full permit history (including any unpermitted work), the tax assessment trajectory, and any open permits — information that doesn't appear in any public API.`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeaway;
  if (soil?.isHydric) {
    takeaway = 'USDA identifies this soil as hydric — a potential wetland indicator. Discuss foundation drainage and any planned additions with your inspector before closing.';
  } else if (soil?.drainageCategory?.color === 'red') {
    takeaway = `Soil drainage here is ${escapeHtml(soil.drainageCategory.label.toLowerCase())}. Ask your inspector specifically about basement moisture and discuss drainage with the seller.`;
  } else if (broadband === null || !broadband?.providers?.length) {
    takeaway = 'Internet connectivity at this address could not be confirmed through FCC data. If remote work or streaming is important, verify service options with local providers before committing.';
  } else if (era?.medianYearBuilt && era.medianYearBuilt < 1978 && era.context?.cautions?.length) {
    takeaway = `Homes in this tract average ${era.medianYearBuilt} — pre-1978 construction. Include a lead paint inspection in your due diligence scope.`;
  } else if (broadband?.hasFiber || broadband?.maxDownloadMbps >= 1000) {
    takeaway = 'Gigabit or fiber internet is available at this address — a meaningful advantage for remote workers and streaming-heavy households.';
  } else {
    takeaway = `Request the permit history and tax record for this specific parcel from the ${escapeHtml(county)} Building Department and Assessor's office before closing — it takes one call and can reveal unpermitted work or unexpected tax increases.`;
  }

  const sources = [
    soil      ? 'USDA Web Soil Survey' : null,
    broadband ? 'FCC National Broadband Map' : null,
    era       ? 'U.S. Census ACS 5-year estimates (construction era)' : null,
  ].filter(Boolean);
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const body = `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">County records, soil surveys, and broadband maps reveal factors specific to this property — ones that don't show up in a listing or a 20-minute showing, but affect ownership costs, livability, and decision-making.</p>
    </div>
    <div class="prem-intel-section">
      <div class="prem-intel-label">Construction Era</div>
      <p class="prem-narrative-body">${eraPara}</p>
      ${eraCautionsHTML}
    </div>
    <div class="prem-intel-section">
      <div class="prem-intel-label">Soil &amp; Drainage ${soilBadgeHTML}</div>
      <p class="prem-narrative-body">${soilPara}</p>
    </div>
    <div class="prem-intel-section">
      <div class="prem-intel-label">Internet Availability</div>
      <p class="prem-narrative-body">${broadbandPara}</p>
      ${broadbandCardsHTML}
    </div>
    <div class="prem-intel-section">
      <div class="prem-intel-label">Tax &amp; Permit Records</div>
      <p class="prem-narrative-body">${taxPermitPara}</p>
    </div>
    <div class="key-takeaway">
      <span class="kt-icon">🔑</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${takeaway}</div>
    </div>
    <p class="prem-disclaimer">Sources: ${escapeHtml(sources.join('; ') || 'See notes above')}. Research date: ${today}. Construction era is a tract-level Census ACS estimate — not specific to this parcel. Parcel-level permit and tax history requires direct inquiry with the county.</p>`;

  const homeSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
  const glanceHTML = buildPropertyGlanceHTML(propIntel);
  return renderChapterCard('property', '11', homeSvg, 'Property Intelligence', 'Soil, broadband, permits, and the details that listings don\'t show.', null, body, null, null, null, glanceHTML || null);
}

function buildPropertyGlanceHTML(propIntel) {
  if (!propIntel) return '';
  const eraLabel = propIntel.era?.context?.era;
  const drain = propIntel.soil?.drainageCategory;

  const items = [
    eraLabel ? `<span class="chapter-glance-item">${escapeHtml(eraLabel.split(' ').slice(0, 4).join(' '))}</span>` : '',
    drain?.label ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">${escapeHtml(drain.label)}</span>` : '',
  ].filter(Boolean).join('');

  return items ? `<div class="chapter-glance">${items}</div>` : '';
}

module.exports = { buildPropertyIntelligenceHTML, buildPropertyGlanceHTML };
