'use strict';
const { escapeHtml } = require('../../utils/text');

const BUCKET_META = {
  check:   { cls: 'bucket--check',   label: 'Things to Check' },
  consider:{ cls: 'bucket--consider', label: 'Things to Consider' },
  cool:    { cls: 'bucket--cool',    label: 'Cool Things to Know' },
};

function renderBucket({ type, text } = {}) {
  const meta = BUCKET_META[type] || BUCKET_META.consider;
  return `<div class="bucket ${meta.cls}">
  <div class="bucket-label">${meta.label}</div>
  <div class="bucket-text">${escapeHtml(text || '')}</div>
</div>`;
}

function renderBuckets(items) {
  if (!items || !items.length) return '';
  return items.map(renderBucket).join('\n');
}

module.exports = { renderBucket, renderBuckets };
