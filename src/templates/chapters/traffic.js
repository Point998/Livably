'use strict';
const { escapeHtml } = require('../../utils/text');

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

function buildTrafficCardHTML(trafficData) {
  if (!trafficData || !trafficData.length) return '';
  const sectionsHTML = trafficData
    .map((t, i) => (i > 0 ? '<div class="traffic-section-divider"></div>' : '') + buildTrafficItemHTML(t.name, t.traffic))
    .join('');
  const waveSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:80" aria-hidden="true"><polyline points="2 12 6 4 10 20 14 8 18 16 22 12" style="--path-len:80"/></svg>`;

  return `
  <section class="chapter" data-ch="traffic">
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
    </div>
    <div class="chapter-full">
      ${sectionsHTML}
    </div>
  </section>
  <div class="chapter-rule"></div>`;
}

module.exports = { buildTrafficItemHTML, buildTrafficCardHTML };
