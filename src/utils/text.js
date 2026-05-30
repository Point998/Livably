'use strict';

const { STATE_ABBRS } = require('./state');

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDriveTime(minutes) {
  return `${minutes} min`;
}

function toTitleCase(str) {
  return str.replace(/\w+/g, (word) => {
    if (word.length === 2 && STATE_ABBRS.has(word.toUpperCase())) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function parseAddressParts(address) {
  const commaIdx = address.indexOf(',');
  if (commaIdx === -1) return { street: address, cityState: '' };
  return {
    street: address.slice(0, commaIdx).trim(),
    cityState: address.slice(commaIdx + 1).trim(),
  };
}

function formatResearchDate() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMoney(n) {
  return n != null ? '$' + Number(n).toLocaleString('en-US') : 'N/A';
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);
}

function getDateSlug() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function safeInt(n) {
  const v = parseInt(n, 10);
  return isNaN(v) || v < 0 ? 0 : v;
}

module.exports = {
  escapeHtml,
  formatDriveTime,
  toTitleCase,
  parseAddressParts,
  formatResearchDate,
  formatMoney,
  slugify,
  getDateSlug,
  safeInt,
};
