'use strict';

// FR-093 — costs logic (rollout #14). Pure computation of the costs chapter's numbers from the
// upstream getPropertyData output. No HTML, no API (CONSTRAINT-009): the STATE_* lookups already
// happened in property/data.js; this layer only does arithmetic the contract serializes.
//
// shortcut: costs/template.js still computes carrying costs inline in ~4 places; this is the new
// single source for the contract, but the SSR template was intentionally NOT refactored onto it
// (surgical scope, matches contract rollouts #1–13). Revisit when the template is next touched.

const { NATIONAL_AVG_PROPERTY_TAX_RATE } = require('../../utils/constants');

// The reference home price the carrying-cost figures are anchored to (established SSR convention).
// Baked into the contract's measure unit so a consumer can't mistake it for an address-specific quote.
const REFERENCE_PRICE = 300000;

// propertyData = { taxRate, insuranceYear, utilitiesMo, homesteadNote, state, ... } (or null/undefined).
function computeCosts(propertyData) {
  if (!propertyData) return null;

  const { taxRate, insuranceYear, utilitiesMo, state } = propertyData;
  const nat = NATIONAL_AVG_PROPERTY_TAX_RATE;

  const tax = Math.round((REFERENCE_PRICE * (taxRate / 100)) / 12);
  const insurance = Math.round(insuranceYear / 12);
  const utilities = Math.round(utilitiesMo);
  const total = tax + insurance + utilities;

  const deltaPct = Math.round(((taxRate - nat) / nat) * 100);
  const direction = taxRate <= nat * 0.9 ? 'below' : taxRate >= nat * 1.1 ? 'above' : 'near';

  return {
    taxRate,
    state: state || null,
    referencePrice: REFERENCE_PRICE,
    monthly: { tax, insurance, utilities, total },
    taxComparison: { direction, deltaPct, referenceValue: nat },
  };
}

module.exports = { computeCosts, REFERENCE_PRICE };
