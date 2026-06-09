/* FR-033 Life-at-Address calculator (client).
 * The pure formula below is a faithful MIRROR of
 * src/modules/reachability/logic.js#computeDrivingProfile — the SERVER is the
 * source of truth. A Jest parity test asserts they stay identical. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node (parity test)
  else root.LivablyCalculator = api;                                          // browser
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clampNum(v, lo, hi) {
    v = Number(v);
    if (isNaN(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function computeProfileClient(inputs, rates) {
    var i = inputs || {};
    var commuteDays  = clampNum(i.commuteDaysPerWeek, 0, 7);
    var commuteMiles = clampNum(i.commuteOneWayMiles, 0, 200);
    var groceryTrips = clampNum(i.groceryTripsPerWeek, 0, 7);
    var cityTrips    = clampNum(i.cityTripsPerMonth, 0, 8);
    var kids         = !!i.hasKidsInSchool;
    var d = rates.tripDistances;

    var weeklyMilesByType = {
      commute: commuteDays * commuteMiles * 2,
      grocery: groceryTrips * d.groceryRoundTripMiles,
      city:    (cityTrips * d.cityRoundTripMiles) / 4.33,
      school:  kids ? d.schoolDaysPerWeek * d.schoolRoundTripMiles : 0,
    };
    var weeklyMilesTotal = weeklyMilesByType.commute + weeklyMilesByType.grocery + weeklyMilesByType.city + weeklyMilesByType.school;
    var annualMiles = Math.round(weeklyMilesTotal * 52);

    return {
      weeklyMilesByType: weeklyMilesByType,
      weeklyMilesTotal: weeklyMilesTotal,
      annualMiles: annualMiles,
      costMarginal: Math.round(annualMiles * rates.marginalCostPerMile),
      costIrs:      Math.round(annualMiles * rates.irsRatePerMile),
      costEv:       Math.round(annualMiles * rates.evKwhPerMile * rates.electricRatePerKwh),
    };
  }

  function dollars(n) { return '$' + Math.round(n).toLocaleString(); }

  function init() {
    var cfgEl = document.getElementById('life-calc-config');
    var root = document.querySelector('.life-calc');
    if (!cfgEl || !root) return;
    var cfg;
    try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
    var rates = cfg.rates;

    function readInputs() {
      return {
        commuteDaysPerWeek:  root.querySelector('#lc-commuteDaysPerWeek').value,
        commuteOneWayMiles:  root.querySelector('#lc-commuteOneWayMiles').value,
        groceryTripsPerWeek: root.querySelector('#lc-groceryTripsPerWeek').value,
        cityTripsPerMonth:   root.querySelector('#lc-cityTripsPerMonth').value,
        hasKidsInSchool:     root.querySelector('#lc-hasKidsInSchool').checked,
      };
    }
    function setText(id, txt) { var el = root.querySelector(id); if (el) el.textContent = txt; }

    function recompute() {
      var r = computeProfileClient(readInputs(), rates);
      setText('#lc-out-marginal', dollars(r.costMarginal));
      setText('#lc-out-miles', r.annualMiles.toLocaleString());
      setText('#lc-out-ev', dollars(r.costEv));
      setText('#lc-out-irs', dollars(r.costIrs));
      ['commuteDaysPerWeek','commuteOneWayMiles','groceryTripsPerWeek','cityTripsPerMonth'].forEach(function (id) {
        var slider = root.querySelector('#lc-' + id);
        var out = root.querySelector('#lc-' + id + '-out');
        if (slider && out) out.textContent = slider.value + (out.textContent.indexOf('mi') > -1 ? ' mi' : '');
      });
    }

    root.querySelectorAll('input').forEach(function (el) {
      el.addEventListener('input', recompute);
      el.addEventListener('change', recompute);
    });
    recompute();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
  }

  return { computeProfileClient: computeProfileClient };
});
