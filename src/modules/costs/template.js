'use strict';
const { escapeHtml, formatMoney } = require('../../utils/text');
const { renderChapterCard } = require('../../templates/components/chapterCard');

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
  const chartSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`;
  const glanceHTML = buildCostsGlanceHTML(p);
  return renderChapterCard('costs', '14', chartSvg, 'Property Costs & Market', 'The monthly numbers behind the asking price.', null, body, null, null, null, glanceHTML || null);
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
