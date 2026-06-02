'use strict';
const { escapeHtml, formatMoney } = require('../../utils/text');
const { renderChapterCard } = require('../../templates/components/chapterCard');

function buildCostsLongTermTab(p) {
  const refPrice = 300000;
  const taxYear  = Math.round(refPrice * (p.taxRate / 100));
  const insYear  = Math.round(p.insuranceYear);
  const utilYear = p.utilitiesMo * 12;
  const maintYear = Math.round(refPrice * 0.01);
  const totalYear = taxYear + insYear + utilYear + maintYear;

  const yr5  = totalYear * 5;
  const yr10 = totalYear * 10;
  const yr30 = totalYear * 30;

  const taxHigh = p.taxRate > 1.5;
  const taxLow  = p.taxRate < 0.5;
  const taxContext = taxHigh
    ? `Property taxes in ${escapeHtml(p.state)} account for ${formatMoney(taxYear)}/year of that total — the largest single variable cost at this price point.`
    : taxLow
    ? `${escapeHtml(p.state)}'s low property taxes keep the carrying cost base lower than most states — taxes account for just ${formatMoney(taxYear)}/year at this price.`
    : `Property taxes at ${p.taxRate.toFixed(2)}% are the largest variable line item at ${formatMoney(taxYear)}/year.`;

  return `
    <p class="prem-narrative-body">At $300k in ${escapeHtml(p.state)}, total carrying costs — taxes, insurance, utilities, and a 1% maintenance reserve — run approximately ${formatMoney(totalYear)}/year before any mortgage payment.</p>
    <div class="growth-permit-stat-row">
      <div class="growth-permit-stat">
        <div class="growth-permit-stat-label">5 Years</div>
        <div class="costs-longterm-stat-val">${formatMoney(yr5)}</div>
        <div class="growth-permit-stat-sub">est. total</div>
      </div>
      <div class="growth-permit-stat">
        <div class="growth-permit-stat-label">10 Years</div>
        <div class="costs-longterm-stat-val">${formatMoney(yr10)}</div>
        <div class="growth-permit-stat-sub">est. total</div>
      </div>
      <div class="growth-permit-stat">
        <div class="growth-permit-stat-label">30 Years</div>
        <div class="costs-longterm-stat-val">${formatMoney(yr30)}</div>
        <div class="growth-permit-stat-sub">est. total</div>
      </div>
    </div>
    <p class="prem-narrative-body">Annual breakdown: ${formatMoney(taxYear)} property tax · ${formatMoney(insYear)} insurance · ${formatMoney(utilYear)} utilities · ${formatMoney(maintYear)} maintenance reserve (1%). ${taxContext}</p>
    <p class="prem-disclaimer">No inflation adjustment applied. Maintenance reserve is an industry rule of thumb — older homes or deferred maintenance will require more. Actual costs vary by county, insurer, and usage.</p>`;
}

function buildCostsVerifyTab(p) {
  const items = [
    {
      icon: '🏛️',
      title: 'Look up the actual property tax bill',
      detail: `The ${p.taxRate.toFixed(2)}% rate is a ${escapeHtml(p.state)} state average. Your specific county may be higher or lower. Search "[county name] property tax records" or "[county name] assessor" to look up the exact assessed value and tax history for this specific parcel — often available free online.`,
    },
    {
      icon: '🛡️',
      title: 'Get multiple insurance quotes',
      detail: 'The NAIC state average is a useful reference, not a quote. Rates vary significantly by home age, construction type, roof condition, and proximity to fire stations. Get at least 3 insurance quotes before closing — rates for the same home can differ by 30–50%.',
    },
    {
      icon: '🔌',
      title: 'Request 12 months of utility bills',
      detail: "Ask the seller's agent for the last 12 months of electric, gas, and water bills. Seasonal variation matters — a home that's cheap to cool in spring can be expensive in August. Utility history is especially important for older homes with original HVAC or limited insulation.",
    },
    {
      icon: '🏘️',
      title: 'Get the full HOA disclosure if applicable',
      detail: 'If this property has an HOA, request the full disclosure package before closing: current fees, operating budget, reserve fund balance, and any pending special assessments. A low monthly fee paired with an underfunded reserve is a common source of unexpected costs.',
    },
    {
      icon: '🔧',
      title: 'Adjust the maintenance reserve for home age',
      detail: "The 1% rule is a starting point. Homes over 20 years old, those with original roofs or HVAC, or properties with deferred maintenance should be budgeted at 1.5–2%. Your home inspection report is the best guide — it will flag systems that are near end-of-life.",
    },
  ];

  const rows = items.map((it) => `
    <div class="safety-prep-item">
      <div class="safety-prep-item-hd">
        <span class="safety-prep-item-icon">${it.icon}</span>
        <span class="safety-prep-item-title">${escapeHtml(it.title)}</span>
      </div>
      <p class="safety-prep-item-detail">${it.detail}</p>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">The cost data in this chapter uses state-level averages — useful for context, but not your actual numbers. Here's how to get the real figures before closing.</p>
    ${rows}`;
}

function buildCostsResearchHTML(p) {
  if (!p) return '';
  const prices = [200000, 250000, 300000, 350000, 400000, 500000];

  const rows = prices.map((price) => {
    const taxMo  = Math.round(price * (p.taxRate / 100) / 12);
    const insMo  = Math.round((p.insuranceYear * (price / 300000)) / 12);
    const utilMo = p.utilitiesMo;
    const total  = taxMo + insMo + utilMo;
    return `
    <tr>
      <td>${formatMoney(price)}</td>
      <td>${formatMoney(taxMo)}</td>
      <td>${formatMoney(insMo)}</td>
      <td>${formatMoney(utilMo)}</td>
      <td><strong>${formatMoney(total)}</strong></td>
    </tr>`;
  }).join('');

  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Monthly Carrying Costs — Extended Range</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Price</th><th>Tax/mo</th><th>Insurance/mo</th><th>Utilities/mo</th><th>Total/mo</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Tax: ${p.taxRate.toFixed(2)}% ${escapeHtml(p.state)} state avg (Lincoln Institute, 2024). Insurance: NAIC 2024 state avg, scaled to price. Utilities: EIA/BLS state avg. HOA and maintenance reserve not included.</p>
    </div>`;
}

function buildCostsDeepDiveHTML(p) {
  if (!p) return '';

  const tabs = [
    { id: 'longterm', label: 'Long-Term View',       content: buildCostsLongTermTab(p) },
    { id: 'verify',   label: 'Verify Before Closing', content: buildCostsVerifyTab(p) },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="cstab-${t.id}" id="csbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="cstab-${t.id}" role="tabpanel" aria-labelledby="csbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="costs-deep-dive">
      <div class="costs-deep-dive-label">Costs in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Costs chapter deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}

function buildPropertyDataHTML(p) {
  if (!p) return '';

  // ── Tax rate narrative ────────────────────────────────────────────────────
  const taxLow  = p.taxRate < 0.5;
  const taxHigh = p.taxRate > 1.5;
  const taxPara = taxLow
    ? `${escapeHtml(p.state)}'s ${p.taxRate.toFixed(2)}% effective property tax rate is among the lowest in the country — a meaningful long-term advantage. For a $350,000 home, that's roughly $${Math.round(350000 * p.taxRate / 100 / 12).toLocaleString()}/month in property tax, not $${Math.round(350000 * 1.5 / 100 / 12).toLocaleString()}+/month in higher-tax states. Check whether your county or city layers additional levies on top of the state average.`
    : taxHigh
    ? `${escapeHtml(p.state)}'s ${p.taxRate.toFixed(2)}% effective rate is on the higher end nationally. For a $350,000 home, that's roughly $${Math.round(350000 * p.taxRate / 100 / 12).toLocaleString()}/month in property taxes. In many high-tax states the trade-off is strong school funding and well-maintained public infrastructure — but factor this into your total monthly cost math.`
    : `${escapeHtml(p.state)}'s ${p.taxRate.toFixed(2)}% effective property tax rate is close to the national average. For a $350,000 home, budget approximately $${Math.round(350000 * p.taxRate / 100 / 12).toLocaleString()}/month for property taxes.`;

  // ── Carrying cost breakdown ───────────────────────────────────────────────
  // Show for $300k and $400k price points
  const prices = [300000, 400000];
  const rows = prices.map((price) => {
    const taxMo  = Math.round(price * (p.taxRate / 100) / 12);
    // Scale insurance from $300k base proportionally
    const insMo  = Math.round((p.insuranceYear * (price / 300000)) / 12);
    const utilMo = p.utilitiesMo;
    const total  = taxMo + insMo + utilMo;
    return { price, taxMo, insMo, utilMo, total };
  });

  const carryingRows = rows.map((r) => `
    <tr class="prem-carry-row">
      <td class="prem-carry-price">${formatMoney(r.price)}</td>
      <td class="prem-carry-cell">${formatMoney(r.taxMo)}</td>
      <td class="prem-carry-cell">${formatMoney(r.insMo)}</td>
      <td class="prem-carry-cell">${formatMoney(r.utilMo)}</td>
      <td class="prem-carry-total">${formatMoney(r.total)}</td>
    </tr>`).join('');

  const carryingTable = `
    <div class="prem-carrying-section">
      <div class="prem-carrying-label">Monthly Carrying Costs (Not Including Mortgage)</div>
      <table class="prem-carry-table">
        <thead>
          <tr>
            <th class="prem-carry-th">Home Price</th>
            <th class="prem-carry-th">Tax</th>
            <th class="prem-carry-th">Insurance</th>
            <th class="prem-carry-th">Utilities</th>
            <th class="prem-carry-th prem-carry-th-total">Monthly Total</th>
          </tr>
        </thead>
        <tbody>${carryingRows}</tbody>
      </table>
      <div class="prem-carrying-note">Tax based on ${p.taxRate.toFixed(2)}% state avg · Insurance from NAIC state avg (2024) · Utilities from EIA state avg · HOA not included</div>
    </div>`;

  // ── Homestead exemption note ──────────────────────────────────────────────
  const homesteadHTML = p.homesteadNote ? `
    <div class="prem-market-note prem-homestead-note">
      <span class="prem-market-note-icon">🏡</span>
      <span><strong>Homestead Exemption:</strong> ${escapeHtml(p.homesteadNote)}</span>
    </div>` : '';

  // ── Valuation redirect ────────────────────────────────────────────────────
  const valuationNote = `
    <div class="prem-market-note">
      <span class="prem-market-note-icon">ℹ️</span>
      <span>Current home values are not shown here — they change daily and Census estimates lag 3–5 years. For current pricing: <strong>Zillow, Redfin, or Realtor.com</strong> all show recent sales and active listings for this address. Your agent can pull a Comparative Market Analysis (CMA) for the most accurate view.</span>
    </div>`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  const lowestCarrying = rows[0];
  let takeaway;
  if (taxHigh) {
    takeaway = `Property taxes in ${escapeHtml(p.state)} add ~${formatMoney(rows[0].taxMo)}/month for a $300k home. Factor this into your offer price math — the tax gap between high- and low-tax states compounds significantly over a 30-year mortgage.`;
  } else if (taxLow) {
    takeaway = `${escapeHtml(p.state)}'s low property tax rate is a genuine long-term savings advantage. On a $350k home, you'd pay ~${formatMoney(Math.round(350000 * p.taxRate / 100 / 12))}/month vs ~${formatMoney(Math.round(350000 * 1.5 / 100 / 12))}/month in a high-tax state — a difference that compounds significantly over 30 years.`;
  } else {
    takeaway = `Total carrying costs for a $300k home in ${escapeHtml(p.state)} run approximately ${formatMoney(lowestCarrying.total)}/month before the mortgage — ${formatMoney(lowestCarrying.taxMo)} tax, ${formatMoney(lowestCarrying.insMo)} insurance, ${formatMoney(lowestCarrying.utilMo)} utilities. Add your mortgage payment for the true monthly cost.`;
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const body = `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">${taxPara}</p>
    </div>
    ${carryingTable}
    ${homesteadHTML}
    ${valuationNote}
    <div class="key-takeaway">
      <span class="kt-icon">🔑</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${takeaway}</div>
    </div>
    <p class="prem-disclaimer">Property tax rate: ${escapeHtml(p.state)} state effective average (Lincoln Institute, 2024). Insurance: NAIC 2024 state averages, scaled to home price. Utilities: EIA/BLS state averages, 2024. These are estimates — your actual costs will vary. Research date: ${today}.</p>`;
  const deepDiveHTML = buildCostsDeepDiveHTML(p);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
  const researchHTML = buildCostsResearchHTML(p);
  const l4HTML = researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '';
  const fullHTML = [l3HTML, l4HTML].filter(Boolean).join('');

  const chartSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`;
  const glanceHTML = buildCostsGlanceHTML(p);
  return renderChapterCard('costs', '14', chartSvg, 'Property Costs & Market', 'The monthly numbers behind the asking price.', null, body, null, fullHTML || null, null, glanceHTML || null);
}

function buildCostsGlanceHTML(p) {
  if (!p) return '';
  const price = 300000;
  const taxMo = Math.round(price * (p.taxRate / 100) / 12);
  const insMo = Math.round(p.insuranceYear / 12);
  const total = taxMo + insMo + p.utilitiesMo;
  return `<div class="chapter-glance">
    <span class="chapter-glance-item">~$${total.toLocaleString()}/mo carrying costs at $300k (before mortgage)</span>
  </div>`;
}

module.exports = { buildPropertyDataHTML, buildCostsGlanceHTML };
