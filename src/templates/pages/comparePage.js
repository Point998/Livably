'use strict';

const { escapeHtml, parseAddressParts } = require('../../utils/text');

function buildCompareFormHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compare Addresses â€" Livably</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="compare-page">
  <header class="header">
    <a href="/" class="logo-link"><div class="logo">Liv<span class="logo-gold">ably</span></div></a>
  </header>
  <div class="compare-container">
    <h1 class="compare-title">Compare Addresses</h1>
    <p class="compare-intro">Compare up to 3 addresses side by side to see which location works best for you.</p>
    <form class="compare-form" id="compareForm">
      <div class="compare-input-group">
        <label class="compare-label" for="addr1">Address 1</label>
        <input class="compare-input" type="text" id="addr1" placeholder="123 Main St, City, State" required>
      </div>
      <div class="compare-input-group">
        <label class="compare-label" for="addr2">Address 2</label>
        <input class="compare-input" type="text" id="addr2" placeholder="456 Oak Ave, City, State" required>
      </div>
      <div class="compare-input-group">
        <label class="compare-label" for="addr3">Address 3 <span class="compare-optional">(optional)</span></label>
        <input class="compare-input" type="text" id="addr3" placeholder="789 Pine Rd, City, State">
      </div>
      <button class="compare-submit" type="submit">Compare Addresses</button>
    </form>
  </div>
  <script>
    document.getElementById('compareForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var addrs = [
        document.getElementById('addr1').value.trim(),
        document.getElementById('addr2').value.trim(),
        document.getElementById('addr3').value.trim(),
      ].filter(Boolean);
      window.location.href = '/compare?addresses=' + encodeURIComponent(addrs.join('|'));
    });
  </script>
</body>
</html>`;
}

function buildCompareLoadingHTML(addressesParam) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably â€" Comparingâ€¦</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="loading-page" data-addresses="${escapeHtml(addressesParam)}">
  <div class="loading-container">
    <div class="loading-logo">Liv<span class="logo-gold">ably</span></div>
    <div class="loading-spinner"></div>
    <p class="loading-message">Researching addressesâ€¦</p>
  </div>
  <script>
    (function () {
      var addresses = document.body.dataset.addresses;
      function reExecScripts(el) {
        el.querySelectorAll('script').forEach(function (old) {
          var s = document.createElement('script');
          for (var i = 0; i < old.attributes.length; i++) {
            s.setAttribute(old.attributes[i].name, old.attributes[i].value);
          }
          s.textContent = old.textContent;
          old.parentNode.replaceChild(s, old);
        });
      }
      fetch('/compare?addresses=' + encodeURIComponent(addresses) + '&fetch=1')
        .then(function (res) { return res.text(); })
        .then(function (html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          document.head.innerHTML = doc.head.innerHTML;
          document.body.className = doc.body.className;
          document.body.innerHTML = doc.body.innerHTML;
          reExecScripts(document.head);
          reExecScripts(document.body);
        })
        .catch(function () {
          document.querySelector('.loading-message').textContent = 'Something went wrong. Please try again.';
        });
    })();
  <\/script>
</body>
</html>`;
}

function buildCompareResultsHTML(reports) {
  const count = reports.length;

  const addrCards = reports.map((r) => {
    const { street, cityState } = parseAddressParts(r.address);
    if (r.error) {
      return `<div class="compare-addr-card compare-addr-error">
      <div class="compare-addr-street">${escapeHtml(street || r.address)}</div>
      <div class="compare-addr-city">${escapeHtml(cityState)}</div>
      <div class="compare-addr-err">Address not found</div>
    </div>`;
    }
    return `<div class="compare-addr-card">
      <div class="compare-addr-street">${escapeHtml(street)}</div>
      <div class="compare-addr-city">${escapeHtml(cityState)}</div>
    </div>`;
  }).join('');

  const serviceRows = [
    { label: 'Grocery', get: (r) => (Array.isArray(r.services?.grocery) ? r.services.grocery[0] : r.services?.grocery) },
    { label: 'Pharmacy',      get: (r) => r.services?.pharmacy },
    { label: 'Hospital',      get: (r) => r.services?.hospital },
    { label: 'Urgent Care',   get: (r) => r.services?.urgentCare },
    { label: 'Highway Access', get: (r) => r.services?.highwayRamp },
    { label: 'Gas Station',   get: (r) => r.services?.gasStation },
  ].map(({ label, get }) => {
    const times = reports.map((r) => (r.error ? null : (get(r)?.driveTimeMinutes ?? null)));
    const validTimes = times.filter((t) => t !== null);
    const minTime = validTimes.length ? Math.min(...validTimes) : null;
    const cells = times.map((time) => {
      if (time === null) return '<td class="compare-cell compare-cell-na">â€"</td>';
      const best = time === minTime && validTimes.length > 1;
      return `<td class="compare-cell${best ? ' compare-cell-best' : ''}">${time} min${best ? ' <span class="compare-winner">âœ"</span>' : ''}</td>`;
    }).join('');
    return `<tr><td class="compare-service">${escapeHtml(label)}</td>${cells}</tr>`;
  }).join('');

  const thCells = reports.map((r) => {
    const { street } = parseAddressParts(r.address);
    return `<th class="compare-th">${escapeHtml(street || r.address)}</th>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Address Comparison â€" Livably</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="compare-page">
  <header class="header">
    <a href="/" class="logo-link"><div class="logo">Liv<span class="logo-gold">ably</span></div></a>
    <div class="report-badge">Comparison</div>
  </header>
  <div class="compare-container compare-results">
    <div class="compare-addr-row compare-cols-${count}">
      ${addrCards}
    </div>
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead>
          <tr>
            <th class="compare-th compare-th-service">Service</th>
            ${thCells}
          </tr>
        </thead>
        <tbody>
          ${serviceRows}
        </tbody>
      </table>
    </div>
    <a href="/compare" class="back-link">â† Compare different addresses</a>
  </div>
</body>
</html>`;
}

module.exports = { buildCompareFormHTML, buildCompareLoadingHTML, buildCompareResultsHTML };
