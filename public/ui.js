(function () {
  'use strict';

  // ── Scroll-in animation (Intersection Observer) ───────────────────────────────

  function initScrollAnimations() {
    if (!window.IntersectionObserver) return;

    var cards = document.querySelectorAll('.chapter-card, .custom-dests-card');
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.dataset.animDelay, 10) || 0;
        setTimeout(function () { el.classList.add('animated-in'); }, delay);
        obs.unobserve(el);
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -48px 0px' });

    cards.forEach(function (el, i) {
      el.classList.add('animate-on-scroll');
      el.dataset.animDelay = i * 55;
      obs.observe(el);
    });
  }

  // ── Animate progress/traffic bars when they scroll into view ─────────────────

  function initBarAnimations() {
    if (!window.IntersectionObserver) return;

    var bars = document.querySelectorAll('.prem-age-fill, .traffic-bar');
    bars.forEach(function (bar) {
      var finalWidth = bar.style.width || getComputedStyle(bar).width;
      bar.dataset.finalWidth = finalWidth;
      bar.style.width = '0';
      bar.style.transition = 'width 0.65s cubic-bezier(0.4,0,0.2,1)';

      var obs = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          setTimeout(function () { bar.style.width = bar.dataset.finalWidth; }, 120);
          obs.disconnect();
        }
      }, { threshold: 0.5 });
      obs.observe(bar);
    });
  }

  // ── Button ripple effect ──────────────────────────────────────────────────────

  function initRipples() {
    var sel = [
      '.btn-primary', '.btn-pdf', '.btn-retry',
      'button[type="submit"]', '.compare-submit', '.share-button',
    ].join(',');

    document.querySelectorAll(sel).forEach(function (btn) {
      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.addEventListener('click', function (e) {
        var rect = btn.getBoundingClientRect();
        var r = document.createElement('span');
        r.className = 'btn-ripple';
        r.style.left = (e.clientX - rect.left) + 'px';
        r.style.top  = (e.clientY - rect.top)  + 'px';
        btn.appendChild(r);
        setTimeout(function () { r.remove(); }, 600);
      });
    });
  }

  // ── Smooth focus rings via keyboard detection ─────────────────────────────────

  function initFocusMode() {
    document.addEventListener('mousedown', function () {
      document.body.classList.remove('keyboard-nav');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') document.body.classList.add('keyboard-nav');
    });
  }

  // ── Loading skeleton pulse for premium cards ──────────────────────────────────
  // (No-op if premium cards are already present from SSR — just adds polish timing)

  function initPremiumEntrance() {
    var premCards = document.querySelectorAll('.chapter-card');
    premCards.forEach(function (card, i) {
      // stagger initial load if page just rendered
      if (document.readyState !== 'complete') {
        card.style.opacity = '0';
        card.style.transform = 'translateY(16px)';
        setTimeout(function () {
          card.style.transition = 'opacity 0.45s ease ' + (i * 0.05) + 's, transform 0.45s ease ' + (i * 0.05) + 's';
          card.style.opacity = '';
          card.style.transform = '';
        }, 80);
      }
    });
  }

  // ── Mobile: close map detail on outside tap ───────────────────────────────────

  function initMapDetailClose() {
    document.addEventListener('click', function (e) {
      var detail = document.getElementById('map-detail');
      if (!detail || !detail.classList.contains('visible')) return;
      if (!detail.contains(e.target) && !e.target.closest('#map')) {
        detail.classList.remove('visible');
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function run() {
    initScrollAnimations();
    initBarAnimations();
    initRipples();
    initFocusMode();
    initMapDetailClose();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
