'use strict';
const { escapeHtml, formatDriveTime } = require('../../utils/text');

function renderDestCard({ name = '', address = '', driveTimeMinutes, note } = {}) {
  const noteHTML = note ? `\n  <p class="dest-note">${escapeHtml(note)}</p>` : '';
  return `<div class="dest-row">
  <div>
    <div class="dest-name">${escapeHtml(name)}</div>
    <div class="dest-address">${escapeHtml(address)}</div>
  </div>
  <div class="drive-time">${formatDriveTime(driveTimeMinutes)}</div>
</div>${noteHTML}`;
}

function renderDestSection({ label = '', dest } = {}) {
  const labelHTML = `<div class="dest-label">${escapeHtml(label)}</div>`;
  if (!dest) {
    const searchQuery = encodeURIComponent(`${label} near me`);
    return `<div class="dest-section">${labelHTML}<p class="dest-note">Data not available for this address. <a href="https://www.google.com/maps/search/${searchQuery}" target="_blank" rel="noopener">Search Google Maps</a> for nearby options.</p></div>`;
  }
  return `<div class="dest-section">
  ${labelHTML}
  ${renderDestCard(dest)}
</div>`;
}

module.exports = { renderDestCard, renderDestSection };
