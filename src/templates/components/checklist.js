'use strict';
const { escapeHtml } = require('../../utils/text');

function renderChecklist({ heading = '', items } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const itemsHTML = safeItems.map((item) => `
  <div class="prem-safety-action">
    <span class="prem-safety-action-icon">${item.icon || ''}</span>
    <div class="prem-safety-action-text">
      <div class="prem-safety-action-label">${escapeHtml(item.label || '')}</div>
      <div class="prem-safety-action-detail">${escapeHtml(item.detail || '')}</div>
    </div>
  </div>`).join('');
  return `<div class="prem-safety-actions">
  <div class="prem-safety-actions-label">${escapeHtml(heading)}</div>
  ${itemsHTML}
</div>`;
}

module.exports = { renderChecklist };
