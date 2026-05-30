'use strict';
const { escapeHtml } = require('../../utils/text');

const DEPTH_LEVELS = ['glance', 'overview', 'deepread', 'research'];
const DEPTH_LABELS = {
  glance:   'Glance',
  overview: 'Overview',
  deepread: 'Deep Read',
  research: 'Research',
};

function renderDepthSelector(chKey, defaultDepth = 'overview') {
  const options = DEPTH_LEVELS.map((d) => {
    const selected = d === defaultDepth;
    return `<li role="option" class="chapter-depth-option${selected ? ' chapter-depth-option--selected' : ''}" data-depth="${d}" aria-selected="${selected}">${DEPTH_LABELS[d]}</li>`;
  }).join('');

  return `<div class="chapter-depth-control" data-ch-key="${escapeHtml(chKey)}">
  <button class="chapter-depth-btn" aria-haspopup="listbox" aria-expanded="false">
    <span class="chapter-depth-label">${DEPTH_LABELS[defaultDepth] || 'Overview'}</span>
    <span class="chapter-depth-caret" aria-hidden="true">▾</span>
  </button>
  <ul class="chapter-depth-menu" role="listbox" aria-label="Content depth" hidden>
    ${options}
  </ul>
</div>`;
}

module.exports = { renderDepthSelector, DEPTH_LABELS };
