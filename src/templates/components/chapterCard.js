'use strict';
const { escapeHtml } = require('../../utils/text');

function renderChapterCard(chKey, chNum, iconSvg, eyebrow, title, introHTML, leftHTML, rightHTML, fullHTML, sourceHTML) {
  const altClass = (parseInt(chNum, 10) || 0) % 2 === 0 ? ' chapter--alt' : '';
  return `
  <section class="chapter${altClass}" data-ch="${chKey}">
    <div class="chapter-inner">
      <div class="chapter-num" aria-hidden="true">${chNum}</div>
      <header class="chapter-hd">
        <div class="chapter-eyebrow">
          ${iconSvg ? `<span class="chapter-icon">${iconSvg}</span>` : ''}
          ${escapeHtml(eyebrow)}
        </div>
        <h2 class="chapter-title">${escapeHtml(title)}</h2>
      </header>
      ${introHTML ? `<p class="chapter-intro">${introHTML}</p>` : ''}
      <div class="chapter-body">
        <div class="chapter-left">${leftHTML || ''}</div>
        ${rightHTML ? `<div class="chapter-right">${rightHTML}</div>` : '<div class="chapter-right"></div>'}
      </div>
      ${fullHTML ? `</div><div class="chapter-full">${fullHTML}</div><div class="chapter-inner chapter-inner--continuation">` : ''}
      ${sourceHTML ? `<div class="chapter-source">${sourceHTML}</div>` : ''}
    </div>
  </section>
  <div class="chapter-rule"></div>`;
}

module.exports = { renderChapterCard };
