'use strict';

const { STATE_AVG_ELECTRIC_RATE, STATE_AVG_RELIABILITY, EV_BATTERY_KWH_REF } = require('../../utils/constants');

// A rate within ±7% of the state average reads as "near" — outside it, below/above.
const RATE_DELTA_THRESHOLD = 0.07;

// CONSTRAINT-001: factual delta vs state average — never a score or grade.
function getElectricRateContext(residentialRate, state) {
  const rate = Number(residentialRate);
  if (!rate || rate <= 0) return null;
  const stateAvg = STATE_AVG_ELECTRIC_RATE[state];
  if (stateAvg == null) return null;

  const delta = (rate - stateAvg) / stateAvg; // signed fraction
  let deltaLabel, color;
  if (delta < -RATE_DELTA_THRESHOLD)      { deltaLabel = 'below state average'; color = 'green'; }
  else if (delta > RATE_DELTA_THRESHOLD)  { deltaLabel = 'above state average'; color = 'orange'; }
  else                                    { deltaLabel = 'near state average';  color = 'gold'; }

  const centsRate = Math.round(rate * 100);
  const centsAvg  = Math.round(stateAvg * 100);
  const narrative =
    `The residential rate here is about ${centsRate}¢/kWh, ${deltaLabel} ` +
    `(the ${state} average is roughly ${centsAvg}¢/kWh). Rates are set by the ` +
    `provider and state regulators, so this reflects the utility serving the address.`;

  return { rate, stateAvg, delta, deltaLabel, color, narrative };
}

function getUtilityType(utilityName) {
  const name = String(utilityName || '').trim();
  if (!name) return null;
  const n = name.toLowerCase();

  // Name heuristics. Assumes EIA/OpenEI-sourced utility names (where `emc`/`rec`
  // reliably denote electric-membership-corp / rural-electric-coop); not robust
  // to arbitrary free text.
  let type;
  if (/co-?op|cooperative|rural electric|\bemc\b|\brec\b/.test(n)) {
    type = 'cooperative';
  } else if (/city of|municipal|public (power|util)|board of public|plant board|\butilities?\b$/.test(n)) {
    type = 'municipal';
  } else {
    type = 'investor-owned';
  }

  const LABEL = {
    cooperative:      'Appears to be a member-owned electric cooperative',
    municipal:        'Appears to be a municipal (city/public) utility',
    'investor-owned': 'Appears to be an investor-owned utility',
  };
  return { type, label: LABEL[type], hedge: true };
}

function getOutageContext(state) {
  if (!state) return null;
  const rec = STATE_AVG_RELIABILITY[state];
  const isNationalFallback = !rec;
  const { saidiHours, saifiEvents } = rec || STATE_AVG_RELIABILITY.NATIONAL;

  const where = isNationalFallback ? 'Nationally' : `In ${state}`;
  const narrative =
    `${where}, utilities average about ${saifiEvents} power interruption(s) per ` +
    `customer per year, totaling roughly ${saidiHours} hours, excluding major ` +
    `storms. This is a state-level average — not specific to this parcel or its ` +
    `feeder line. Actual reliability depends on local infrastructure and tree cover.`;

  return { saidiHours, saifiEvents, isNationalFallback, narrative };
}

// Inference only (no parcel-level source exists for water/sewer/gas). CONSTRAINT-007
// classification (ruralMode) is computed upstream and passed in (CONSTRAINT-014).
function getServiceInference(ruralMode) {
  const isRural = ruralMode === 'rural' || ruralMode === 'remote';
  const verifyAction =
    "Confirm on the seller's property disclosure or with the county — water, sewer, " +
    'and gas service can vary lot by lot and this is an inference from area density.';

  if (isRural) {
    return {
      water: 'Likely a private well',
      sewer: 'Likely a septic system',
      gas:   'Likely propane or electric-only (natural gas mains are uncommon here)',
      verify: true,
      verifyAction,
    };
  }
  return {
    water: 'Likely municipal water',
    sewer: 'Likely municipal sewer',
    gas:   'Likely natural gas is available',
    verify: true,
    verifyAction,
  };
}

function getEvChargingCost(residentialRate) {
  const rate = Number(residentialRate);
  if (!rate || rate <= 0) return null;
  const fullChargeCost = Math.round(EV_BATTERY_KWH_REF * rate * 100) / 100;
  const homeNote =
    `At the local residential rate, a full charge of a typical ${EV_BATTERY_KWH_REF} ` +
    `kWh battery costs about $${fullChargeCost.toFixed(2)} at home — far cheaper than ` +
    `public DC-fast charging. Home charging needs a 240V Level 2 circuit; most garages ` +
    `can add one for $500–$2,000.`;
  return { batteryKwh: EV_BATTERY_KWH_REF, fullChargeCost, homeNote };
}

module.exports = {
  getElectricRateContext,
  getUtilityType,
  getOutageContext,
  getServiceInference,
  getEvChargingCost,
};
