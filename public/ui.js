/* ═══════════════════════════════════════════════════════
   LIVABLY — UI Animation System v2
   Purposeful. Every animation earns its place.
   Respects prefers-reduced-motion throughout.
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── 1. Chapter scroll-reveals ──────────────────────────
  // Observes .chapter elements. On intersection:
  //   • Adds .is-visible to .chapter-num, .chapter-title, .chapter-intro
  //   • Adds .is-drawn to the .chapter itself (triggers SVG draw via CSS)

  function initChapterReveals() {
    function revealChapter(chapter) {
      var num   = chapter.querySelector('.chapter-num');
      var title = chapter.querySelector('.chapter-title');
      var intro = chapter.querySelector('.chapter-intro');
      if (num)   num.classList.add('is-visible');
      if (title) title.classList.add('is-visible');
      if (intro) intro.classList.add('is-visible');
      chapter.classList.add('is-drawn');
    }

    if (!window.IntersectionObserver) {
      document.querySelectorAll('.chapter').forEach(revealChapter);
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        revealChapter(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -60px 0px' });

    document.querySelectorAll('.chapter').forEach(function (el) {
      obs.observe(el);
    });
  }

  // ── 2. SVG draw-on-scroll animations ──────────────────
  // CSS uses stroke-dasharray/stroke-dashoffset via .chapter.is-drawn.
  // JS does not need to manage this — CSS handles it via the .is-drawn
  // class added by initChapterReveals. This function is a no-op but kept
  // in case getTotalLength-based dynamic path lengths are needed later.

  function initSVGDrawAnimations() {
    // CSS drives the animation via:
    //   .chapter-icon svg path { stroke-dasharray: var(--path-len, 200); stroke-dashoffset: var(--path-len, 200); }
    //   .chapter.is-drawn .chapter-icon svg path { stroke-dashoffset: 0; }
    // No JS needed here — initChapterReveals adds .is-drawn.
  }

  // ── 3. Hero insight rows ───────────────────────────────

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

  // ── 4. Drive-time counters ─────────────────────────────

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

    document.querySelectorAll('.drive-time, .dest-time').forEach(function (el) {
      var text = el.textContent.trim();
      if (/^\d+/.test(text)) {
        el.dataset.driveTarget = text;
        obs.observe(el);
      }
    });
  }

  // ── 5. Traffic bar animations ──────────────────────────

  function initTrafficBars() {
    if (!window.IntersectionObserver) {
      document.querySelectorAll('.traffic-bar').forEach(function (b) {
        b.style.width = b.dataset.w !== undefined ? b.dataset.w + '%' : '0%';
      });
      return;
    }

    document.querySelectorAll('.traffic-bar').forEach(function (bar) {
      var w = bar.dataset.w !== undefined ? bar.dataset.w + '%' : '0%';
      bar.dataset.finalWidth = w;
      bar.style.width = '0';
    });

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll('.traffic-bar').forEach(function (bar, i) {
          var delay = reduced ? 0 : i * 80;
          setTimeout(function () {
            bar.style.width = bar.dataset.finalWidth || '0%';
          }, delay);
        });
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.2 });

    document.querySelectorAll('.chapter-full, .traffic-dest-section').forEach(function (s) {
      if (s.querySelector('.traffic-bar')) obs.observe(s);
    });
  }

  // ── 6. Age / demographic bar animations ────────────────

  function initAgeBars() {
    if (!window.IntersectionObserver) return;

    document.querySelectorAll('.prem-age-fill').forEach(function (fill) {
      var w = fill.dataset.w !== undefined ? fill.dataset.w + '%' : '0%';
      fill.dataset.finalWidth = w;
      fill.style.width = '0';
    });

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll('.prem-age-fill').forEach(function (fill, i) {
          var delay = reduced ? 0 : i * 80;
          setTimeout(function () {
            fill.style.width = fill.dataset.finalWidth || '0%';
          }, delay);
        });
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.3 });

    document.querySelectorAll('.chapter').forEach(function (ch) {
      if (ch.querySelector('.prem-age-fill')) obs.observe(ch);
    });
  }

  // ── 7. Frost timeline draw ─────────────────────────────
  // .grow-frost-fill has data-final-width; animates from 0 on scroll.

  function initFrostTimeline() {
    if (!window.IntersectionObserver) {
      document.querySelectorAll('.grow-frost-fill').forEach(function (fill) {
        if (fill.dataset.finalWidth) fill.style.width = fill.dataset.finalWidth;
      });
      return;
    }

    document.querySelectorAll('.grow-frost-fill').forEach(function (fill) {
      fill.style.width = '0%';
    });

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var fill = entry.target.querySelector('.grow-frost-fill');
        if (fill) {
          setTimeout(function () {
            fill.style.width = fill.dataset.finalWidth || '50%';
          }, reduced ? 0 : 200);
        }
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    document.querySelectorAll('.grow-frost-timeline').forEach(function (el) {
      obs.observe(el);
    });
  }

  // ── 8. Bortle scale marker ─────────────────────────────
  // Marker position is stored in data-left; animate from 0 on scroll.

  function initBortleMarker() {
    var marker = document.querySelector('.prem-bortle-marker');
    if (!marker || reduced) return;

    var targetLeft = marker.dataset.left !== undefined ? marker.dataset.left + '%' : '50%';
    marker.style.left = '0%';
    marker.style.transition = 'none';

    var obs = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      setTimeout(function () {
        marker.style.transition = 'left 1s cubic-bezier(0.16,1,0.3,1)';
        marker.style.left = targetLeft;
      }, 200);
      obs.disconnect();
    }, { threshold: 0.5 });

    obs.observe(marker.parentElement);
  }

  // ── 9. Sticky nav ──────────────────────────────────────

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
    onScroll();
  }

  // ── 10. Focus-ring keyboard detection ─────────────────

  function initFocusRing() {
    document.addEventListener('mousedown', function () {
      document.body.classList.remove('keyboard-nav');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') document.body.classList.add('keyboard-nav');
    });
  }

  // ── 11. Destination item stagger ──────────────────────
  // .dest-item cards fade/slide in with staggered delay.

  function initDestItems() {
    if (reduced || !window.IntersectionObserver) {
      document.querySelectorAll('.dest-item').forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var grid = entry.target;
        grid.querySelectorAll('.dest-item').forEach(function (item, i) {
          setTimeout(function () {
            item.classList.add('is-visible');
          }, i * 60);
        });
        obs.unobserve(grid);
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.dest-grid').forEach(function (g) {
      obs.observe(g);
    });
  }

  // ── 12. Garden deep dive — toggle + tab switching ─────

  function initGardenDeepDive() {
    var toggles = document.querySelectorAll('.garden-deep-toggle');
    toggles.forEach(function (toggle) {
      var dive = toggle.parentElement ? toggle.parentElement.querySelector('.garden-deep-dive') : null;
      if (!dive) return;
      toggle.setAttribute('aria-expanded', dive.hidden ? 'false' : 'true');
      toggle.addEventListener('click', function () {
        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (expanded) {
          dive.hidden = true;
        } else {
          dive.hidden = false;
        }
      });
    });

    var navs = document.querySelectorAll('.garden-tab-nav');
    navs.forEach(function (nav) {
      var deepDive = nav.closest('.garden-deep-dive');
      var panels = deepDive ? deepDive.querySelectorAll('.garden-tab-panel') : [];
      nav.addEventListener('click', function (e) {
        var btn = e.target.closest('[role="tab"]');
        if (!btn) return;
        var tabId = btn.getAttribute('aria-controls');
        nav.querySelectorAll('[role="tab"]').forEach(function (t) {
          t.setAttribute('aria-selected', 'false');
          t.classList.remove('garden-tab--active');
        });
        btn.setAttribute('aria-selected', 'true');
        btn.classList.add('garden-tab--active');
        panels.forEach(function (panel) {
          panel.classList.remove('garden-tab-panel--active');
          panel.hidden = true;
        });
        var activePanel = deepDive ? deepDive.querySelector('[id="' + tabId + '"]') : null;
        if (activePanel) {
          activePanel.classList.add('garden-tab-panel--active');
          activePanel.hidden = false;
        }
      });
    });
  }

  // ── Init ───────────────────────────────────────────────

  function run() {
    initStickyNav();
    initInsightRows();
    initChapterReveals();
    initSVGDrawAnimations();
    initDriveTimeCounters();
    initTrafficBars();
    initAgeBars();
    initFrostTimeline();
    initBortleMarker();
    initDestItems();
    initFocusRing();
    initGardenDeepDive();

    // Initialize Lucide icons if available
    if (window.lucide) window.lucide.createIcons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
