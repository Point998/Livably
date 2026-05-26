'use strict';
const { escapeHtml } = require('../../utils/text');

function renderFooter({ source = '', date = '' } = {}) {
  const parts = [source && escapeHtml(source), date && escapeHtml(date)].filter(Boolean);
  return `<p class="prem-disclaimer">${parts.join('. Research date: ')}</p>`;
}

module.exports = { renderFooter };
