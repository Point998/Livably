'use strict';
const { escapeHtml, formatMoney } = require('../../utils/text');
const { badgeClass, renderChapterCard } = require('../components');

function buildIncomeTab(dist, medianIncome) {
  const national = [22, 23, 18, 14, 23];
  const medianNote = medianIncome ? `Median household income in this tract: ${formatMoney(medianIncome)}.` : '';
  const suppressedNote = dist.hasSuppressed ? ' Some income brackets had suppressed data (small cell counts) and are shown as 0.' : '';

  const bars = dist.brackets.map((b, i) => {
    const diff = b.pct - national[i];
    const diffLabel = diff > 2 ? `(${diff} pts above US avg)`
      : diff < -2 ? `(${Math.abs(diff)} pts below US avg)`
      : '(near US avg)';
    return `
      <div class="prem-age-row">
        <span class="prem-age-label">${escapeHtml(b.label)}</span>
        <div class="prem-age-track"><div class="prem-age-fill" data-w="${b.pct}"></div></div>
        <span class="prem-age-pct">${b.pct}%</span>
      </div>
      <div class="prem-demo-note">${escapeHtml(diffLabel)}</div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">${medianNote} Distribution of households across income brackets for this Census tract.${suppressedNote}</p>
    ${bars}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B19001. US averages: approx. 22% under $25k, 23% $25–50k, 18% $50–75k, 14% $75–100k, 23% over $100k.</p>`;
}

function buildEducationTab(ladder) {
  const national = [12, 27, 20, 20, 13];
  const bars = ladder.steps.map((s, i) => {
    const diff = s.pct - national[i];
    const diffLabel = diff > 2 ? `(${diff} pts above US avg)`
      : diff < -2 ? `(${Math.abs(diff)} pts below US avg)`
      : '(near US avg)';
    return `
      <div class="prem-age-row">
        <span class="prem-age-label">${escapeHtml(s.label)}</span>
        <div class="prem-age-track"><div class="prem-age-fill" data-w="${s.pct}"></div></div>
        <span class="prem-age-pct">${s.pct}%</span>
      </div>
      <div class="prem-demo-note">${escapeHtml(diffLabel)}</div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">Educational attainment for adults 25 and older in this Census tract.</p>
    ${bars}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B15003. US averages approximate.</p>`;
}

function buildHouseholdTab(comp) {
  const items = [
    { label: 'Family households',       pct: comp.familyPct },
    { label: 'Married-couple families', pct: comp.marriedCouplePct },
    { label: 'Single-parent families',  pct: comp.singleParentPct },
    { label: 'Non-family households',   pct: comp.nonfamilyPct },
    { label: 'Living alone',            pct: comp.livingAlonePct },
  ];

  const bars = items.map(it => `
    <div class="prem-age-row">
      <span class="prem-age-label">${escapeHtml(it.label)}</span>
      <div class="prem-age-track"><div class="prem-age-fill" data-w="${it.pct}"></div></div>
      <span class="prem-age-pct">${it.pct}%</span>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">Household structure across the ${comp.totalHouseholds.toLocaleString()} households in this Census tract.</p>
    ${bars}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B11001.</p>`;
}

function buildCommuteTab(commute) {
  const modes = [
    { label: 'Drove alone',      pct: commute.droveAlonePct },
    { label: 'Carpooled',        pct: commute.carpoolPct },
    { label: 'Public transit',   pct: commute.transitPct },
    { label: 'Walked',           pct: commute.walkedPct },
    { label: 'Bicycle',          pct: commute.bicyclePct },
    { label: 'Worked from home', pct: commute.wfhPct },
    { label: 'Other',            pct: commute.otherPct },
  ].filter(m => m.pct > 0);

  const bars = modes.map(m => `
    <div class="prem-age-row">
      <span class="prem-age-label">${escapeHtml(m.label)}</span>
      <div class="prem-age-track"><div class="prem-age-fill" data-w="${m.pct}"></div></div>
      <span class="prem-age-pct">${m.pct}%</span>
    </div>`).join('');

  const transitNote = commute.transitPct > 10
    ? ` Transit at ${commute.transitPct}% suggests viable public transit infrastructure nearby.` : '';
  const wfhNote = commute.wfhPct > 25
    ? ` With ${commute.wfhPct}% working from home, expect higher daytime neighborhood activity than in drive-to-work areas.` : '';

  return `
    <p class="prem-narrative-body">How the ${commute.totalWorkers.toLocaleString()} workers in this tract commute.${transitNote}${wfhNote}</p>
    ${bars}
    <p class="prem-disclaimer">Source: U.S. Census Bureau ACS 5-year estimates, Table B08006.</p>`;
}

function buildCommunityDeepDiveHTML(d) {
  if (!d) return '';

  const tabs = [
    d.incomeDistribution
      ? { id: 'income',    label: 'Income Distribution',      content: buildIncomeTab(d.incomeDistribution, d.income?.median) }
      : null,
    d.educationLadder
      ? { id: 'education', label: 'Education Ladder',          content: buildEducationTab(d.educationLadder) }
      : null,
    d.householdComposition
      ? { id: 'household', label: 'Household Types',           content: buildHouseholdTab(d.householdComposition) }
      : null,
    d.commuteMode
      ? { id: 'commute',   label: 'How People Get to Work',    content: buildCommuteTab(d.commuteMode) }
      : null,
  ].filter(Boolean);

  if (!tabs.length) return '';

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="cdtab-${t.id}" id="cdbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="cdtab-${t.id}" role="tabpanel" aria-labelledby="cdbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="community-deep-dive">
      <div class="community-deep-dive-label">Demographics in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Community demographics deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}

function buildCommunityResearchHTML(d) {
  if (!d) return '';
  if (!d.incomeDistribution && !d.educationLadder && !d.tractFips) return '';

  const incomeTableRows = d.incomeDistribution
    ? d.incomeDistribution.brackets.map(b =>
        `<tr><td>${escapeHtml(b.label)}</td><td>${b.pct}%</td><td>${b.count != null ? b.count.toLocaleString() : '—'}</td></tr>`
      ).join('')
    : '';

  const incomeTable = incomeTableRows ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Income Distribution — Raw Counts</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Bracket</th><th>Percent</th><th>Households</th></tr></thead>
          <tbody>${incomeTableRows}</tbody>
        </table>
      </div>
    </div>` : '';

  const eduTable = d.educationLadder?.steps?.length ? `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Educational Attainment — Adults 25+ (ACS B15003)</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Attainment Level</th><th>% of Adults 25+</th></tr></thead>
          <tbody>
            ${d.educationLadder.steps.map(s =>
              `<tr><td>${escapeHtml(s.label)}</td><td>${s.pct}%</td></tr>`
            ).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const censusLink = d.tractFips?.censusExplorerUrl
    ? `<div class="climate-research-section"><p class="prem-narrative-body">Full ACS data for this Census tract: <a href="${escapeHtml(d.tractFips.censusExplorerUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(d.tractFips.censusExplorerUrl)}</a></p></div>`
    : '';

  const content = [incomeTable, eduTable, censusLink].filter(Boolean).join('');
  return content || '';
}

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
  const glanceHTML = buildCommunityGlanceHTML(d);

  const deepDiveHTML = buildCommunityDeepDiveHTML(d);
  const researchHTML = buildCommunityResearchHTML(d);
  const fullHTML = [
    deepDiveHTML  ? `<div class="depth-l3">${deepDiveHTML}</div>` : '',
    researchHTML  ? `<div class="depth-l4">${researchHTML}</div>` : '',
  ].filter(Boolean).join('');

  return renderChapterCard('community', '07', peopleSvg, 'Demographics & Community', 'Who lives here, and what that means for daily life.', null, body, null, fullHTML || null, null, glanceHTML || null);
}

function buildCommunityGlanceHTML(demographics) {
  if (!demographics) return '';
  const { ownershipRate, medianTenureYears } = demographics.community || {};
  const income = demographics.income;

  const items = [
    ownershipRate != null ? `<span class="chapter-glance-item">${ownershipRate}% owner-occupied</span>` : '',
    medianTenureYears != null ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">Median ${medianTenureYears}-yr tenure</span>` : '',
    income?.level?.label ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">${escapeHtml(income.level.label)}</span>` : '',
  ].filter(Boolean).join('');

  return items ? `<div class="chapter-glance">${items}</div>` : '';
}

module.exports = { buildDemographicsHTML, buildCommunityGlanceHTML };
