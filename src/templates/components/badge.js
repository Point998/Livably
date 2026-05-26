'use strict';
const { escapeHtml } = require('../../utils/text');

const COLOR_MAP = {
  green:      'badge-green',
  lightgreen: 'badge-lightgreen',
  gold:       'badge-gold',
  orange:     'badge-orange',
  red:        'badge-red',
  muted:      'badge-muted',
};

function badgeClass(color) {
  return COLOR_MAP[color] || COLOR_MAP.muted;
}

function renderBadge({ label = '', color } = {}) {
  return `<span class="prem-badge ${badgeClass(color)}">${escapeHtml(label)}</span>`;
}

function renderInlineBadge({ label = '', color } = {}) {
  return `<span class="prem-inline-badge ${badgeClass(color)}">${escapeHtml(label)}</span>`;
}

module.exports = { badgeClass, renderBadge, renderInlineBadge };
