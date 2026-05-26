'use strict';
const { escapeHtml } = require('../../utils/text');

function renderKeyTakeaway({ icon = '🔑', text } = {}) {
  const safeText = escapeHtml(text || '');
  return `<div class="key-takeaway">
  <span class="kt-icon">${icon || ''}</span>
  <div class="kt-body"><strong>Key Takeaway:</strong> ${safeText}</div>
</div>`;
}

module.exports = { renderKeyTakeaway };
