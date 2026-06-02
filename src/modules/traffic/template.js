'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderDepthSelector } = require('../../templates/components/depthSelector');

function buildTrafficItemHTML(name, traffic) {
  const { variations, stats } = traffic;
  const barsHTML = variations.map((v) => {
    const widthPct = stats.max > 0 ? Math.round((v.minutes / stats.max) * 100) : 100;
    const isBest = v.minutes === stats.min;
    const isWorst = v.minutes === stats.max && stats.range > 0;
    let barClass = 'traffic-bar-mid';
    if (isBest) barClass = 'traffic-bar-best';
    else if (isWorst) barClass = 'traffic-bar-worst';
    else if (v.minutes < stats.avg) barClass = 'traffic-bar-good';
    const tagHTML = isBest
      ? ' <span class="traffic-tag traffic-tag-best">Best</span>'
      : isWorst
      ? ' <span class="traffic-tag traffic-tag-worst">Worst</span>'
      : '';
    return `
      <div class="traffic-row">
        <span class="traffic-slot">${escapeHtml(v.display)}</span>
        <div class="traffic-bar-track"><div class="traffic-bar ${barClass}" data-w="${widthPct}"></div></div>
        <span class="traffic-mins">${v.minutes}&nbsp;min${tagHTML}</span>
      </div>`;
  }).join('');

  const warningHTML = stats.range > 10 ? ' <span class="traffic-warning">High variation</span>' : '';
  return `
  <div class="traffic-dest-section">
    <div class="traffic-dest-name">${escapeHtml(name)}</div>
    ${barsHTML}
    <div class="traffic-stat-row">Avg ${stats.avg} min &nbsp;·&nbsp; Range ${stats.min}–${stats.max} min${warningHTML}</div>
  </div>`;
}

function buildTrafficGlanceHTML(trafficData) {
  if (!trafficData || !trafficData.length) return '';
  const t = trafficData[0];
  const variations = t.traffic?.variations || [];
  const maxPct = variations.length > 0 ? Math.max(...variations.map((v) => v.percentAboveBase || 0)) : 0;
  const glanceText = maxPct < 15
    ? 'No meaningful rush hour at this address'
    : `Peak traffic adds ~${maxPct}% to drive times`;
  return `<div class="chapter-glance"><span class="chapter-glance-item">${escapeHtml(glanceText)}</span></div>`;
}

function buildTrafficDeepDiveHTML(trafficData) {
  if (!trafficData || !trafficData.length) return '';

  const sorted = [...trafficData].sort((a, b) =>
    (b.traffic?.stats?.range || 0) - (a.traffic?.stats?.range || 0)
  );
  const primary = sorted[0];
  const { stats, variations } = primary.traffic;

  const maxPct = Math.max(...trafficData.flatMap(t =>
    t.traffic.variations.map(v => v.percentAboveBase || 0)
  ));

  const bestSlot  = variations.find(v => v.minutes === stats.min);
  const worstSlot = variations.find(v => v.minutes === stats.max && stats.range > 0);

  const impactNarrative = maxPct >= 20
    ? `Traffic adds up to ${maxPct}% to drive times during peak hours — a meaningful difference that compounds quickly on a daily commute.`
    : maxPct >= 10
    ? `Traffic adds up to ${maxPct}% to drive times during peak hours. Noticeable, but manageable with some schedule flexibility.`
    : `Traffic variation at this address is minimal — peak hours add less than 10% to drive times. Timing your trips matters less here than at many urban addresses.`;

  const bestWorstHTML = (bestSlot && worstSlot && stats.range > 0) ? `
    <div class="traffic-ddi-stat-row">
      <div class="traffic-ddi-stat">
        <div class="traffic-ddi-stat-label">Best window</div>
        <div class="traffic-ddi-stat-val">${escapeHtml(bestSlot.display)}</div>
        <div class="traffic-ddi-stat-sub">${stats.min} min to ${escapeHtml(primary.name)}</div>
      </div>
      <div class="traffic-ddi-stat">
        <div class="traffic-ddi-stat-label">Worst window</div>
        <div class="traffic-ddi-stat-val">${escapeHtml(worstSlot.display)}</div>
        <div class="traffic-ddi-stat-sub">${stats.max} min to ${escapeHtml(primary.name)}</div>
      </div>
    </div>` : '';

  const annualHours = Math.round(stats.range * 500 / 60);
  const annualHTML = (stats.range >= 5 && annualHours > 0) ? `
    <p class="prem-narrative-body">If you commute daily, the difference between the best and worst departure time adds up to roughly <strong>${annualHours} hours per year</strong> for the ${escapeHtml(primary.name)} trip alone. That's based on ${stats.range} min/trip × ~500 commutes/year (2 trips/day, 5 days/week, 50 weeks).</p>` : '';

  return `
    <div class="traffic-deep-dive">
      <div class="traffic-deep-dive-label">Traffic Pattern Analysis</div>
      <p class="prem-narrative-body">${impactNarrative}</p>
      ${bestWorstHTML}
      ${annualHTML}
      <p class="prem-disclaimer">Based on Google Distance Matrix departure time sampling. Actual traffic varies by day and season.</p>
    </div>`;
}

function buildTrafficCardHTML(trafficData) {
  if (!trafficData || !trafficData.length) return '';
  const sectionsHTML = trafficData
    .map((t, i) => (i > 0 ? '<div class="traffic-section-divider"></div>' : '') + buildTrafficItemHTML(t.name, t.traffic))
    .join('');
  const waveSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:80" aria-hidden="true"><polyline points="2 12 6 4 10 20 14 8 18 16 22 12" style="--path-len:80"/></svg>`;

  const deepDiveHTML = buildTrafficDeepDiveHTML(trafficData);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';

  return `
  <section class="chapter" data-ch="traffic" data-depth="overview">
    <div class="chapter-inner">
      <div class="chapter-num" aria-hidden="true">04</div>
      <header class="chapter-hd">
        <div class="chapter-eyebrow">
          <span class="chapter-icon">${waveSvg}</span>
          Traffic Patterns
        </div>
        <h2 class="chapter-title">Drive times shift. Know the range before you commit.</h2>
      </header>
      <p class="chapter-intro">Drive times aren't fixed — they shift significantly based on when you leave. The "Worst" time is the one to internalize if you're planning a regular commute.</p>
      <div class="depth-l1">${buildTrafficGlanceHTML(trafficData)}</div>
      ${l3HTML}
      ${renderDepthSelector('traffic')}
    </div>
    <div class="chapter-full depth-l2">
      ${sectionsHTML}
    </div>
  </section>
  <div class="chapter-rule"></div>`;
}

module.exports = { buildTrafficItemHTML, buildTrafficCardHTML };
