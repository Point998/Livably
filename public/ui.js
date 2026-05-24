/* ═══════════════════════════════════════════════════════
   LIVABLY — UI Animation System
   Purposeful. Every animation earns its place.
   Respects prefers-reduced-motion throughout.
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── 1. Chapter card scroll-reveal ──────────────────────

  function initCardReveals() {
    if (!window.IntersectionObserver) {
      document.querySelectorAll('.chapter-card, .custom-dests-card').forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.dataset.animDelay, 10) || 0;
        if (reduced) {
          el.classList.add('is-visible');
        } else {
          setTimeout(function () { el.classList.add('is-visible'); }, delay);
        }
        obs.unobserve(el);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.chapter-card, .custom-dests-card').forEach(function (el, i) {
      el.dataset.animDelay = i * 45;
      obs.observe(el);
    });
  }

  // ── 2. Hero At-a-Glance insight rows ───────────────────

  function initInsightRows() {
    var rows = document.querySelectorAll('.hero-insight-row');
    if (!rows.length) return;

    if (reduced) {
      rows.forEach(function (r) { r.classList.add('is-visible'); });
      return;
    }

    rows.forEach(function (row, i) {
      setTimeout(function () { row.classList.add('is-visible'); }, 300 + i * 150);
    });
  }

  // ── 3. Drive-time counters ─────────────────────────────

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateCounter(el, target, suffix, duration) {
    if (reduced) { el.textContent = target + suffix; return; }
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      el.textContent = Math.round(easeOut(progress) * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initDriveTimeCounters() {
    if (!window.IntersectionObserver) return;

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var raw = el.dataset.driveTarget;
        if (!raw) { obs.unobserve(el); return; }
        var match = raw.match(/^(\d+)(.*)$/);
        if (match) animateCounter(el, parseInt(match[1], 10), match[2], 800);
        obs.unobserve(el);
      });
    }, { threshold: 0.6 });

    document.querySelectorAll('.drive-time').forEach(function (el) {
      var text = el.textContent.trim();
      if (/^\d+/.test(text)) {
        el.dataset.driveTarget = text;
        obs.observe(el);
      }
    });
  }

  // ── 4. Traffic bar animations ──────────────────────────

  function initTrafficBars() {
    if (!window.IntersectionObserver) {
      document.querySelectorAll('.traffic-bar').forEach(function (b) {
        if (b.dataset.finalWidth) b.style.width = b.dataset.finalWidth;
      });
      return;
    }

    // Store final widths, set to 0
    document.querySelectorAll('.traffic-bar').forEach(function (bar) {
      var w = bar.style.width || '0%';
      bar.dataset.finalWidth = w;
      bar.style.width = '0';
    });

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var section = entry.target;
        var bars = section.querySelectorAll('.traffic-bar');
        bars.forEach(function (bar, i) {
          var delay = reduced ? 0 : i * 100;
          setTimeout(function () {
            bar.style.width = bar.dataset.finalWidth || '0%';
          }, delay);
        });
        obs.unobserve(section);
      });
    }, { threshold: 0.2 });

    document.querySelectorAll('.traffic-dest-section').forEach(function (s) {
      obs.observe(s);
    });
  }

  // ── 5. Age / demographic bar animations ────────────────

  function initAgeBars() {
    if (!window.IntersectionObserver) return;

    document.querySelectorAll('.prem-age-fill').forEach(function (fill) {
      var w = fill.style.width || '0%';
      fill.dataset.finalWidth = w;
      fill.style.width = '0';
    });

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var container = entry.target;
        container.querySelectorAll('.prem-age-fill').forEach(function (fill, i) {
          var delay = reduced ? 0 : i * 80;
          setTimeout(function () {
            fill.style.width = fill.dataset.finalWidth || '0%';
          }, delay);
        });
        obs.unobserve(container);
      });
    }, { threshold: 0.3 });

    document.querySelectorAll('.chapter-card').forEach(function (card) {
      if (card.querySelector('.prem-age-fill')) obs.observe(card);
    });
  }

  // ── 6. Bortle scale marker ─────────────────────────────

  function initBortleMarker() {
    var marker = document.querySelector('.prem-bortle-marker');
    if (!marker) return;

    if (reduced) return;

    var target = marker.dataset.targetLeft || marker.style.left || '50%';
    marker.style.left = '0%';

    var obs = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        setTimeout(function () { marker.style.left = target; }, 200);
        obs.disconnect();
      }
    }, { threshold: 0.5 });

    obs.observe(marker.parentElement);
  }

  // ── 7. Sticky nav ──────────────────────────────────────

  function initStickyNav() {
    var nav = document.getElementById('reportNav');
    if (!nav) return;
    var threshold = Math.max(window.innerHeight * 0.6, 200);

    function onScroll() {
      if (window.scrollY > threshold) {
        nav.classList.add('scrolled');
        nav.removeAttribute('aria-hidden');
      } else {
        nav.classList.remove('scrolled');
        nav.setAttribute('aria-hidden', 'true');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run once on init
  }

  // ── 8. Focus-ring keyboard detection ──────────────────

  function initFocusRing() {
    document.addEventListener('mousedown', function () {
      document.body.classList.remove('keyboard-nav');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') document.body.classList.add('keyboard-nav');
    });
  }

  // ── Init ───────────────────────────────────────────────

  function run() {
    initStickyNav();
    initInsightRows();
    initCardReveals();
    initDriveTimeCounters();
    initTrafficBars();
    initAgeBars();
    initBortleMarker();
    initFocusRing();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
