'use strict';
const { escapeHtml, formatMoney } = require('../../utils/text');
const { badgeClass, renderChapterCard } = require('../components');

function buildDemographicsHTML(d) {
  if (!d) return '';

  function ageBar(label, pct) {
    return `
    <div class="prem-age-row">
      <span class="prem-age-label">${escapeHtml(label)}</span>
      <div class="prem-age-track"><div class="prem-age-fill" data-w="${pct}"></div></div>
      <span class="prem-age-pct">${pct}%</span>
    </div>`;
  }

  const incomeBadge = `<span class="prem-badge ${badgeClass(d.income.level.color)}">${escapeHtml(d.income.level.label)}</span>`;
  const eduBadge = `<span class="prem-badge ${badgeClass(d.education.level.color)}">${escapeHtml(d.education.level.label)}</span>`;

  const ageNarrative = (() => {
    const under18 = d.age.under18;
    const seniors = d.age.age65plus;
    const youngAdults = d.age.age18to34;
    if (under18 > 28) return `With ${under18}% of residents under 18, this is family-heavy territory. Expect school buses, youth sports, and neighbors who share your kid-related schedule. The upside: a strong parenting community and lots of kids the same age for yours to grow up with.`;
    if (seniors > 25) return `${seniors}% of residents are 65 or older. That typically means a quieter, more established neighborhood with strong community ties and low turnover. Neighbors tend to know each other and have been here a while.`;
    if (youngAdults > 30) return `${youngAdults}% of residents are 18–34. This skews younger—expect more energy, more turnover, and a neighborhood that's still forming its identity. Can mean more vibrancy; can also mean less of the settled-in community feel that comes with long-term residents.`;
    return `The age mix here is fairly balanced across life stages. That typically produces a stable, diverse community—families, working adults, and established residents sharing the same streets.`;
  })();

  const incomeNarrative = d.income.median
    ? (() => {
        const inc = d.income.median;
        const nationalMedian = 74580;
        const diff = Math.round(Math.abs(inc - nationalMedian) / 1000) * 1000;
        const rel = inc > nationalMedian
          ? `${formatMoney(diff)} above the national median of ${formatMoney(nationalMedian)}`
          : inc < nationalMedian
          ? `${formatMoney(diff)} below the national median of ${formatMoney(nationalMedian)}`
          : `at the national median`;
        return `Median household income in this Census tract is ${formatMoney(inc)} — ${rel}. Income data here is Census tract level (ACS 5-year estimates) and reflects the broader area, not this specific block or street.`;
      })()
    : null;

  const communityNarrative = (() => {
    const ownership = d.community.ownershipRate;
    const tenure    = d.community.medianTenureYears;
    const tenureStr = tenure ? ` The median resident has lived here for about ${tenure} year${tenure !== 1 ? 's' : ''} — ${tenure >= 12 ? 'a strong signal of neighborhood stability and community investment' : tenure >= 7 ? 'indicating a settled community that also sees some turnover' : 'a relatively mobile population, common in growth areas and near large employers'}.` : '';
    if (ownership > 75) return `${ownership}% homeownership puts this firmly in owner-occupied territory.${tenureStr} People who own tend to stay longer, invest in their properties, and participate more in local decisions — that translates to stable, maintained streetscapes and a stronger sense of shared stakes.`;
    if (ownership > 50) return `${ownership}% homeownership means a mixed community of owners and renters.${tenureStr} Ownership majority generally signals investment and stability, while the renter population keeps the neighborhood more dynamic.`;
    return `${ownership}% homeownership — majority renter.${tenureStr} Renters aren't less invested in their communities, but higher turnover is typical. That can make it harder to build long-term neighbor relationships and often correlates with more frequent property management changes in the surrounding buildings.`;
  })();

  // ── Community character synthesis ────────────────────────────────────────
  const synthesisParts = [];
  if (d.age.under18 > 28) synthesisParts.push('family-oriented with active youth presence');
  else if (d.age.age65plus > 25) synthesisParts.push('established and senior-skewing');
  else if (d.age.age18to34 > 30) synthesisParts.push('young and professionally active');
  else synthesisParts.push('multi-generational');

  if (d.community.ownershipRate > 70) synthesisParts.push('high owner-occupancy');
  else if (d.community.ownershipRate < 45) synthesisParts.push('predominantly renter');

  if (d.education.collegePct > 50) synthesisParts.push('college-educated workforce');

  const synthesisLine = synthesisParts.length >= 2
    ? `This Census tract is characterized by: ${synthesisParts.join(', ')}. That combination shapes the daily character of the neighborhood more than any single metric.`
    : null;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeaway;
  const tenure = d.community.medianTenureYears;
  if (tenure && tenure >= 15) {
    takeaway = `Median resident tenure of ~${tenure} years is a strong stability indicator — these are neighbors who chose to stay. That kind of community continuity is difficult to find and hard to replicate.`;
  } else if (tenure && tenure <= 5) {
    takeaway = `Median resident tenure of ~${tenure} years signals a mobile population — common in growth areas and university towns. Expect a changing cast of neighbors but also a neighborhood still forming its identity.`;
  } else if (d.community.ownershipRate > 80) {
    takeaway = `${d.community.ownershipRate}% homeownership is exceptionally high — the majority of your neighbors are owners invested in their property and the neighborhood. This level of ownership correlates strongly with neighborhood stability and active community engagement.`;
  } else if (d.age.under18 > 30) {
    takeaway = `${d.age.under18}% of residents are under 18 — a genuinely family-heavy area. School quality and youth programs will matter to nearly every neighbor you'll have.`;
  } else {
    takeaway = `The ${d.community.type.label.toLowerCase()} character of this Census tract — ${d.community.ownershipRate}% ownership, median age ${d.medianAge ?? '?'} — is the baseline for what daily neighborhood life looks and feels like.`;
  }

  const body = `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">${ageNarrative}</p>
      ${incomeNarrative ? `<p class="prem-narrative-body">${incomeNarrative}</p>` : ''}
      <p class="prem-narrative-body">${communityNarrative}</p>
      ${synthesisLine ? `<p class="prem-narrative-body prem-synthesis-line">${synthesisLine}</p>` : ''}
    </div>
    <div class="prem-demo-grid">
      <div class="prem-demo-card">
        <div class="prem-demo-title">👨‍👩‍👧‍👦 Age Distribution</div>
        <div class="prem-demo-summary">${escapeHtml(d.age.primaryGroup)}</div>
        ${ageBar('Under 18', d.age.under18)}
        ${ageBar('18–34', d.age.age18to34)}
        ${ageBar('35–64', d.age.age35to64)}
        ${ageBar('65+', d.age.age65plus)}
        ${d.medianAge ? `<div class="prem-demo-note">Median age: ${d.medianAge} years</div>` : ''}
      </div>
      <div class="prem-demo-card">
        <div class="prem-demo-title">💵 Income</div>
        ${d.income.median ? `<div class="prem-demo-big">${formatMoney(d.income.median)}</div><div class="prem-demo-sub">Median household income</div>` : '<div class="prem-demo-sub">Income data unavailable</div>'}
        ${incomeBadge}
      </div>
      <div class="prem-demo-card">
        <div class="prem-demo-title">🎓 Education</div>
        <div class="prem-edu-stats">
          <div><span class="prem-edu-pct">${d.education.bachelor}%</span><span class="prem-edu-lbl">Bachelor's</span></div>
          <div><span class="prem-edu-pct">${d.education.graduate}%</span><span class="prem-edu-lbl">Graduate</span></div>
        </div>
        ${eduBadge}
      </div>
      <div class="prem-demo-card">
        <div class="prem-demo-title">${d.community.densityType.icon} Community</div>
        <div class="prem-community-item">${d.community.densityType.icon} ${escapeHtml(d.community.densityType.label)} area</div>
        <div class="prem-community-item">${d.community.type.icon} ${escapeHtml(d.community.type.label)}</div>
        <div class="prem-community-item">🏠 ${d.community.ownershipRate}% homeownership</div>
        ${d.community.medianTenureYears ? `<div class="prem-community-item">📅 ~${d.community.medianTenureYears} yr median resident tenure</div>` : ''}
        ${d.community.avgHHSize ? `<div class="prem-community-item">👥 ${d.community.avgHHSize} avg household size</div>` : ''}
      </div>
    </div>
    <div class="key-takeaway">
      <span class="kt-icon">🔑</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${takeaway}</div>
    </div>
    <p class="prem-disclaimer">Data: U.S. Census Bureau American Community Survey 5-year estimates (2022). Census tract level. Provided for informational purposes only; not to be used as a basis for housing discrimination.</p>`;
  const peopleSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  return renderChapterCard('community', '07', peopleSvg, 'Demographics & Community', 'Who lives here, and what that means for daily life.', null, body, null, null, null);
}

module.exports = { buildDemographicsHTML };
