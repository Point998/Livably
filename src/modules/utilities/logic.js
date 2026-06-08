'use strict';

const { STATE_AVG_ELECTRIC_RATE, STATE_AVG_RELIABILITY, EV_BATTERY_KWH_REF } = require('../../utils/constants');

// CONSTRAINT-001: factual delta vs state average — never a score or grade.
function getElectricRateContext(residentialRate, state) {
  const rate = Number(residentialRate);
  if (!rate || rate <= 0) return null;
  const stateAvg = STATE_AVG_ELECTRIC_RATE[state];
  if (stateAvg == null) return null;

  const delta = (rate - stateAvg) / stateAvg; // signed fraction
  let deltaLabel, color;
  if (delta < -0.07)      { deltaLabel = 'below state average'; color = 'green'; }
  else if (delta > 0.07)  { deltaLabel = 'above state average'; color = 'orange'; }
  else                    { deltaLabel = 'near state average';  color = 'gold'; }

  const centsRate = Math.round(rate * 100);
  const centsAvg  = Math.round(stateAvg * 100);
  const narrative =
    `The residential rate here is about ${centsRate}¢/kWh, ${deltaLabel} ` +
    `(the ${state} average is roughly ${centsAvg}¢/kWh). Rates are set by the ` +
    `provider and state regulators, so this reflects the utility serving the address.`;

  return { rate, stateAvg, delta, deltaLabel, color, narrative };
}

module.exports = { getElectricRateContext };
