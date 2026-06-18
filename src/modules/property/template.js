'use strict';
const { escapeHtml } = require('../../utils/text');
const { badgeClass, renderChapterCard } = require('../../templates/components');


function buildSoilTab(soil, soilwebUrl) {
  if (!soil) {
    const lookup = soilwebUrl
      ? ` You can also look up this exact location in the <a href="${soilwebUrl}" target="_blank" rel="noopener noreferrer">UC-Davis SoilWeb survey</a>.`
      : '';
    return `<p class="prem-narrative-body">USDA soil data was not available for this location. For site-specific drainage information, request a geotechnical report or ask the seller about any known drainage issues.${lookup}</p>`;
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
        <span class="prem-badge ${badgeClass('orange')}">Hydric — Wetland Indicator</span>
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

function buildEraHealthRisks(medianYear) {
  if (medianYear == null || isNaN(medianYear) || medianYear >= 2000) return '';

  let items;
  if (medianYear < 1940) {
    items = [
      {
        title: 'Lead paint',
        body: 'Assumed present in original surfaces. Any renovation disturbing painted surfaces requires lead-safe practices. Full abatement costs $10,000–$30,000.',
      },
      {
        title: 'Plumbing',
        body: 'Galvanized or cast iron plumbing may be near end of life. Full replacement runs $4,000–$15,000.',
      },
      {
        title: 'Electrical',
        body: 'Knob-and-tube wiring possible if not updated. An electrician\'s assessment before closing is worth the cost — full rewire is $8,000–$15,000.',
      },
      {
        title: 'Asbestos',
        body: 'Common in insulation, floor tiles, and siding from this era. Testing costs $250–$800; abatement if required is $1,500–$30,000+.',
      },
    ];
  } else if (medianYear < 1960) {
    items = [
      {
        title: 'Lead paint',
        body: 'Pre-1978 construction — lead paint is likely in original finishes. Testing costs $20–$50 per room.',
      },
      {
        title: 'Asbestos',
        body: 'Common in popcorn ceilings, floor tiles, and pipe insulation from this era. Undisturbed asbestos isn\'t a health risk; disturbed during renovation is.',
      },
      {
        title: 'Plumbing',
        body: 'Original galvanized plumbing may be aging toward end of life. Ask the inspector to assess pipe condition specifically.',
      },
    ];
  } else if (medianYear < 1978) {
    items = [
      {
        title: 'Lead paint',
        body: 'Pre-1978 construction — lead paint in original finishes is federally presumed. Sellers are required to disclose known hazards, but testing is the only way to confirm presence.',
      },
      {
        title: 'Aluminum wiring',
        body: 'Homes built 1965–1973 often used aluminum branch circuit wiring, which has higher fire risk than copper if connections weren\'t properly maintained. Ask your electrician to inspect specifically for aluminum wiring.',
      },
      {
        title: 'Asbestos',
        body: 'Common in floor tiles, textured ceilings, and pipe insulation. Testing before any renovation is the right call.',
      },
    ];
  } else if (medianYear < 1990) {
    items = [
      {
        title: 'Polybutylene plumbing',
        body: 'Polybutylene plumbing was commonly installed 1978–1995 and was recalled for high failure risk. Ask directly whether it has been replaced — full replacement costs $4,000–$15,000.',
      },
      {
        title: 'Asbestos',
        body: 'Possible in textured surfaces or floor tiles if not previously remediated. Ask the inspector to check.',
      },
    ];
  } else {
    // medianYear >= 1990 and < 2000
    items = [
      {
        title: 'Polybutylene plumbing',
        body: 'If built before 1995, check whether polybutylene plumbing was installed and replaced.',
      },
      {
        title: 'HVAC',
        body: 'Homes of this era may have original HVAC systems approaching end of life (15–20 year lifespan). Ask the inspector to note system age and condition.',
      },
    ];
  }

  const itemsHTML = items.map(item => `
  <div class="prem-intel-era-risk-item">
    <div class="prem-intel-era-risk-title">${escapeHtml(item.title)}</div>
    <p class="prem-intel-era-risk-body">${escapeHtml(item.body)}</p>
  </div>`).join('');

  return `
<div class="prem-intel-era-risks">
  <div class="prem-intel-era-risks-label">What to Watch For in Homes from This Era</div>
  ${itemsHTML}
</div>`;
}

function buildHousingAgeTab(housingAgeBands, era) {
  if (!housingAgeBands?.bands?.length) {
    const eraRisksHTML = buildEraHealthRisks(era?.medianYearBuilt);
    return `<p class="prem-narrative-body">Housing age distribution data was not available for this Census tract.</p>
    ${eraRisksHTML}`;
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

  const eraRisksHTML = buildEraHealthRisks(era?.medianYearBuilt);
  return `
    ${medianNote}
    ${bars}
    ${riskNotes}
    ${eraRisksHTML}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B25034. Tract-level data — not specific to this parcel.</p>`;
}

function buildPropertyDeepDiveHTML(propIntel) {
  if (!propIntel) return '';

  const tabs = [
    { id: 'soil',        label: 'Soil & Foundation',  content: buildSoilTab(propIntel.soil, propIntel.soilwebUrl) },
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

  const { soil, soilwebUrl, housingAgeBands, locationInfo } = propIntel;
  const county = locationInfo?.county || 'this county';

  const assessorUrl   = `https://www.google.com/search?q=${encodeURIComponent(`${county} county assessor property records`)}`;
  const buildingUrl   = `https://www.google.com/search?q=${encodeURIComponent(`${county} county building department permit records`)}`;
  // FR-072 — point-specific SoilWeb AOI when available; WSS homepage otherwise.
  const soilSurveyUrl = soilwebUrl || `https://websoilsurvey.sc.egov.usda.gov/`;
  const censusUrl     = `https://data.census.gov/table?id=B25034`;

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
      <p class="prem-disclaimer">Full soil data: <a href="${soilSurveyUrl}" target="_blank" rel="noopener noreferrer">${soilwebUrl ? 'this location in UC-Davis SoilWeb' : 'USDA Web Soil Survey'}</a></p>
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
      </ul>
    </div>`;

  const content = [soilSection, ageTable, linksSection].filter(Boolean).join('');
  return content || '';
}

function buildPropertyIntelligenceHTML(propIntel) {
  if (!propIntel) return '';
  const { soil, era, locationInfo } = propIntel;
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

  // ── Tax & Permit note ─────────────────────────────────────────────────────
  const assessorSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${county} county assessor property records`)}`;
  const taxPermitPara = `Property tax history and permit records for this specific parcel are public records available from the <a href="${assessorSearchUrl}" target="_blank" rel="noopener">${escapeHtml(county)} Assessor</a> and Building Department. One call before closing reveals the full permit history (including any unpermitted work), the tax assessment trajectory, and any open permits — information that doesn't appear in any public API.`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeaway;
  if (soil?.isHydric) {
    takeaway = 'USDA identifies this soil as hydric — a potential wetland indicator. Discuss foundation drainage and any planned additions with your inspector before closing.';
  } else if (soil?.drainageCategory?.color === 'red') {
    takeaway = `Soil drainage here is ${escapeHtml(soil.drainageCategory.label.toLowerCase())}. Ask your inspector specifically about basement moisture and discuss drainage with the seller.`;
  } else if (era?.medianYearBuilt && era.medianYearBuilt < 1978 && era.context?.cautions?.length) {
    takeaway = `Homes in this tract average ${era.medianYearBuilt} — pre-1978 construction. Include a lead paint inspection in your due diligence scope.`;
  } else {
    takeaway = `Request the permit history and tax record for this specific parcel from the ${escapeHtml(county)} Building Department and Assessor's office before closing — it takes one call and can reveal unpermitted work or unexpected tax increases.`;
  }

  const sources = [
    soil ? 'USDA Web Soil Survey' : null,
    era  ? 'U.S. Census ACS 5-year estimates (construction era)' : null,
  ].filter(Boolean);
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const body = `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">County records and soil surveys reveal factors specific to this property — ones that don't show up in a listing or a 20-minute showing, but affect ownership costs, livability, and decision-making.</p>
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

  return renderChapterCard('property', '11', homeSvg, 'Property Intelligence', 'Soil, permits, and the details that listings don\'t show.', null, body, null, fullHTML || null, null, glanceHTML || null);
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
