'use strict';
const { escapeHtml } = require('../../utils/text');
const { badgeClass, renderChapterCard } = require('../../templates/components');

function buildBroadbandTab(broadband) {
  if (!broadband?.providers?.length) {
    return `<p class="prem-narrative-body">No provider data available. Check the <a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noopener">FCC National Broadband Map</a> by entering this address directly.</p>`;
  }

  const hasHighUpload = broadband.providers.some(p => p.upload >= 100);
  const remoteNote = hasHighUpload
    ? `<p class="prem-narrative-body">At least one provider offers upload speeds of 100 Mbps or higher — suitable for remote work with video conferencing and large file uploads.</p>`
    : '';

  const cards = broadband.providers.map(p => {
    const fiberBadge = p.tech === 'Fiber' ? `<span class="prem-badge prem-badge--green">Fiber</span>` : '';
    return `
      <div class="prem-intel-bb-provider prem-intel-bb-provider--full">
        <span class="prem-intel-bb-name">${escapeHtml(p.name)}</span>
        <span class="prem-intel-bb-tech">${escapeHtml(p.tech)}</span>
        ${fiberBadge}
        <span class="prem-intel-bb-speed">${p.download ? `↓ ${p.download} Mbps` : '—'}</span>
        <span class="prem-intel-bb-speed">${p.upload ? `↑ ${p.upload} Mbps` : '—'}</span>
      </div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">All confirmed providers at this address. Upload speed is the key metric for remote workers — standard cable plans often advertise high download speeds but throttle uploads to 10–20 Mbps.</p>
    ${remoteNote}
    <div class="prem-intel-bb-providers">${cards}</div>
    <p class="prem-disclaimer">Source: FCC National Broadband Map. Advertised speeds; actual speeds may vary.</p>`;
}

function buildSoilTab(soil) {
  if (!soil) {
    return `<p class="prem-narrative-body">USDA soil data was not available for this location. For site-specific drainage information, request a geotechnical report or ask the seller about any known drainage issues.</p>`;
  }

  const drainClass = soil.drainageCategory
    ? `<div class="prem-intel-soil-detail">
        <span class="prem-intel-soil-label">USDA Drainage Class</span>
        <span class="prem-badge ${badgeClass(soil.drainageCategory.color)}">${escapeHtml(soil.drainageCategory.label)}</span>
        <p class="prem-narrative-body">${escapeHtml(soil.drainageCategory.implication)}</p>
      </div>`
    : soil.drainagecl
      ? `<div class="prem-intel-soil-detail"><span class="prem-intel-soil-label">USDA Drainage Class</span> ${escapeHtml(soil.drainagecl)}</div>`
      : '';

  const hydricSection = soil.isHydric
    ? `<div class="prem-intel-soil-detail prem-intel-soil-detail--hydric">
        <span class="prem-intel-soil-label">Hydric Soil</span>
        <span class="prem-badge prem-badge--orange">Hydric — Wetland Indicator</span>
        <p class="prem-narrative-body">USDA classifies this soil as hydric, indicating it formed under saturated conditions. This is a potential wetland indicator and may affect foundation drainage, landscaping, and any planned additions or outbuildings. Discuss with your inspector and consider a drainage evaluation.</p>
      </div>`
    : '';

  return `
    <div class="prem-intel-soil-card">
      <div class="prem-intel-soil-detail">
        <span class="prem-intel-soil-label">Soil Map Unit</span>
        <span class="prem-intel-soil-value">${escapeHtml(soil.muname || 'Unknown')}</span>
      </div>
      ${drainClass}
      ${hydricSection}
    </div>
    <p class="prem-disclaimer">Source: USDA Web Soil Survey (SDA). Soil data is mapped at the map unit level, not parcel-specific. Site conditions may vary.</p>`;
}

function buildHousingAgeTab(housingAgeBands, era) {
  if (!housingAgeBands?.bands?.length) {
    return `<p class="prem-narrative-body">Housing age distribution data was not available for this Census tract.</p>`;
  }

  const ERA_RISK = [
    { label: 'Pre-1960', note: 'Pre-1978 homes: lead paint presumed in original surfaces. Homes pre-1960 may have original plumbing and electrical.' },
    { label: '1960s',    note: 'Pre-1978: lead paint likely in original finishes. Asbestos common in floor tiles, insulation, or textured ceilings.' },
    { label: '1970s',    note: 'Pre-1978: lead paint likely in original finishes. Aluminum wiring was common in this era — electrical inspection recommended.' },
    { label: '1980s',    note: 'Polybutylene plumbing was common (recalled for failure risk). Asbestos possible in textured surfaces or tiles.' },
  ];

  const bars = housingAgeBands.bands.map(b => `
    <div class="prem-age-row">
      <span class="prem-age-label">${escapeHtml(b.label)}</span>
      <div class="prem-age-track"><div class="prem-age-fill" data-w="${b.pct}"></div></div>
      <span class="prem-age-pct">${b.pct}%</span>
    </div>`).join('');

  const medianNote = era?.medianYearBuilt
    ? `<p class="prem-narrative-body">Median year built in this Census tract: <strong>${era.medianYearBuilt}</strong>. Distribution below shows the full decade breakdown.</p>`
    : '<p class="prem-narrative-body">Decade distribution of housing units in this Census tract.</p>';

  const riskNotes = ERA_RISK
    .filter(r => {
      const band = housingAgeBands.bands.find(b => b.label === r.label);
      return band && band.pct > 5;
    })
    .map(r => `<div class="prem-intel-era-note">${escapeHtml(r.note)}</div>`)
    .join('');

  return `
    ${medianNote}
    ${bars}
    ${riskNotes}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B25034. Tract-level data — not specific to this parcel.</p>`;
}

function buildPropertyDeepDiveHTML(propIntel) {
  if (!propIntel) return '';

  const tabs = [
    { id: 'internet',    label: 'Internet Providers', content: buildBroadbandTab(propIntel.broadband) },
    { id: 'soil',        label: 'Soil & Foundation',  content: buildSoilTab(propIntel.soil) },
    { id: 'buildingage', label: 'Building Age',        content: buildHousingAgeTab(propIntel.housingAgeBands, propIntel.era) },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="pdtab-${t.id}" id="pdbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="pdtab-${t.id}" role="tabpanel" aria-labelledby="pdbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="property-deep-dive">
      <div class="community-deep-dive-label">Property Intelligence in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Property intelligence deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}

function buildPropertyResearchHTML(propIntel) {
  if (!propIntel) return '';

  const { broadband, soil, housingAgeBands, locationInfo } = propIntel;
  const county = locationInfo?.county || 'this county';

  const assessorUrl   = `https://www.google.com/search?q=${encodeURIComponent(`${county} county assessor property records`)}`;
  const buildingUrl   = `https://www.google.com/search?q=${encodeURIComponent(`${county} county building department permit records`)}`;
  const fccUrl        = `https://broadbandmap.fcc.gov/`;
  const soilSurveyUrl = `https://websoilsurvey.sc.egov.usda.gov/`;
  const censusUrl     = `https://data.census.gov/table?id=B25034`;

  const providerTable = broadband?.providers?.length ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Broadband Providers — All Data (FCC)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Provider</th><th>Technology</th><th>Download (Mbps)</th><th>Upload (Mbps)</th></tr></thead>
          <tbody>
            ${broadband.providers.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.tech)}</td><td>${p.download || '—'}</td><td>${p.upload || '—'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const soilSection = soil ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">USDA Soil Reference</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Field</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Map Unit Name</td><td>${escapeHtml(soil.muname || '—')}</td></tr>
            <tr><td>Drainage Class</td><td>${escapeHtml(soil.drainagecl || '—')}</td></tr>
            <tr><td>Hydric Rating</td><td>${escapeHtml(soil.hydricrating || '—')}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Full soil data: <a href="${soilSurveyUrl}" target="_blank" rel="noopener noreferrer">USDA Web Soil Survey</a></p>
    </div>` : '';

  const ageTable = housingAgeBands?.bands?.length ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Housing Age Distribution — Raw Counts (ACS B25034)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Period</th><th>Units</th><th>% of Tract</th></tr></thead>
          <tbody>
            ${housingAgeBands.bands.map(b => `<tr><td>${escapeHtml(b.label)}</td><td>${b.count.toLocaleString()}</td><td>${b.pct}%</td></tr>`).join('')}
            <tr><td><strong>Total</strong></td><td><strong>${housingAgeBands.totalUnits.toLocaleString()}</strong></td><td>—</td></tr>
          </tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Full Census table: <a href="${censusUrl}" target="_blank" rel="noopener noreferrer">Census data.census.gov — Table B25034</a></p>
    </div>` : '';

  const linksSection = `
    <div class="climate-research-section">
      <div class="climate-research-section-label">County Records — Direct Links</div>
      <ul class="climate-research-links">
        <li><a href="${assessorUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(county)} County Assessor — Property Tax Records</a></li>
        <li><a href="${buildingUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(county)} County Building Department — Permit History</a></li>
        <li><a href="${fccUrl}" target="_blank" rel="noopener noreferrer">FCC National Broadband Map — Search This Address</a></li>
      </ul>
    </div>`;

  const content = [providerTable, soilSection, ageTable, linksSection].filter(Boolean).join('');
  return content || '';
}

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
  const glanceHTML   = buildPropertyGlanceHTML(propIntel);
  const deepDiveHTML = buildPropertyDeepDiveHTML(propIntel);
  const researchHTML = buildPropertyResearchHTML(propIntel);
  const fullHTML = [
    deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '',
    researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '',
  ].filter(Boolean).join('');

  return renderChapterCard('property', '11', homeSvg, 'Property Intelligence', 'Soil, broadband, permits, and the details that listings don\'t show.', null, body, null, fullHTML || null, null, glanceHTML || null);
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
