'use strict';

const { escapeHtml } = require('../../utils/text');
const { ERROR_ICONS } = require('../../utils/constants');

function buildErrorHTML(type, title, message, address, retryAfter) {
  const icon = ERROR_ICONS[type] || '⚠️';
  const tryAgainLink = address
    ? `\n    <a href="/?address=${encodeURIComponent(address)}" class="btn-retry">Try again</a>`
    : '';

  const retryButtonHTML = retryAfter
    ? `<button id="retryBtn" class="btn-retry" disabled>Retry in <span id="countdown">${retryAfter}</span>s</button>`
    : '';

  const countdownScriptHTML = retryAfter ? `
  <script>
    (function () {
      var secs = ${Number(retryAfter)};
      var btn = document.getElementById('retryBtn');
      var countEl = document.getElementById('countdown');
      var iv = setInterval(function () {
        secs--;
        if (countEl) countEl.textContent = secs;
        if (secs <= 0) {
          clearInterval(iv);
          if (btn) { btn.disabled = false; btn.textContent = 'Retry Now'; }
        }
      }, 1000);
      if (btn) btn.addEventListener('click', function () { window.location.reload(); });
    })();
  <\/script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="livably-error" content="${escapeHtml(type)}">
  <title>Livably</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="error-page">
  <div class="error-container">
    <div class="error-icon">${icon}</div>
    <h1 class="error-title">${escapeHtml(title)}</h1>
    <p class="error-message">${escapeHtml(message)}</p>
    ${retryButtonHTML}${tryAgainLink}
    <a href="/" class="back-link">Try a different address</a>
  </div>${countdownScriptHTML}
</body>
</html>`;
}

function buildLoadingHTML(address) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Livably – Building your report…</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/report.css">
</head>
<body class="loading-page" data-address="${escapeHtml(address)}">
  <div class="loading-brand">Liv<span>ably</span></div>
  <div class="loading-address">${escapeHtml(address)}</div>
  <div class="loading-progress-track">
    <div class="loading-progress-fill" id="loading-progress"></div>
  </div>
  <p class="loading-message" id="loading-msg">Finding your address…</p>
  <script>
    (function () {
      var messages = [
        'Finding your address…',
        'Checking your flood zone…',
        'Finding the nearest emergency room…',
        'Calculating 8am Tuesday drive times…',
        'Identifying native plants for your yard…',
        'Locating nearby schools…',
        'Checking air quality and radon zone…',
        'Building your report…'
      ];
      var msgEl = document.getElementById('loading-msg');
      var progressEl = document.getElementById('loading-progress');
      var idx = 0;
      var address = document.body.dataset.address;

      // Animate progress bar
      var progressPct = 5;
      var maxAutoProgress = 85;
      progressEl.style.width = progressPct + '%';
      var progressInterval = setInterval(function () {
        progressPct = Math.min(progressPct + (Math.random() * 6 + 2), maxAutoProgress);
        progressEl.style.width = progressPct + '%';
      }, 2200);

      var cycleInterval = setInterval(function () {
        msgEl.style.opacity = '0';
        setTimeout(function () {
          idx = (idx + 1) % messages.length;
          msgEl.textContent = messages[idx];
          msgEl.style.opacity = '1';
        }, 280);
      }, 2200);

      setTimeout(function () {
        clearInterval(cycleInterval);
        msgEl.style.opacity = '0';
        setTimeout(function () {
          msgEl.textContent = 'This is taking longer than usual…';
          msgEl.style.opacity = '1';
        }, 280);
      }, 18000);

      function startCountdown(retryFn) {
        var secs = 30;
        msgEl.textContent = 'Too many requests. Retrying in ' + secs + 's…';
        var timer = setInterval(function () {
          secs--;
          if (secs <= 0) {
            clearInterval(timer);
            retryFn();
          } else {
            msgEl.textContent = 'Too many requests. Retrying in ' + secs + 's…';
          }
        }, 1000);
      }

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

      function doFetch() {
        fetch('/report' + location.search + '&fetch=1')
          .then(function (res) { return res.text(); })
          .then(function (html) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');
            var errorMeta = doc.querySelector('meta[name="livably-error"]');
            if (errorMeta && errorMeta.getAttribute('content') === 'RATE_LIMIT') {
              clearInterval(cycleInterval);
              clearInterval(progressInterval);
              startCountdown(doFetch);
              return;
            }
            // Complete progress bar before swapping DOM
            clearInterval(progressInterval);
            if (progressEl) progressEl.style.width = '100%';
            setTimeout(function () {
              document.head.innerHTML = doc.head.innerHTML;
              document.body.className = doc.body.className;
              document.body.innerHTML = doc.body.innerHTML;
              reExecScripts(document.head);
              reExecScripts(document.body);
            }, 300);
          })
          .catch(function () {
            clearInterval(cycleInterval);
            clearInterval(progressInterval);
            msgEl.style.opacity = '0';
            setTimeout(function () {
              msgEl.innerHTML = 'Connection issue. <a href="' + location.pathname + location.search + '">Try again</a>';
              msgEl.style.opacity = '1';
            }, 280);
          });
      }

      doFetch();
    })();
  <\/script>
</body>
</html>`;
}

module.exports = { buildErrorHTML, buildLoadingHTML };
