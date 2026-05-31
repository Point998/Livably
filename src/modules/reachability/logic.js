'use strict';
const { GROCERY_EXCLUDED_TYPES } = require('../../utils/constants');

function isExcludedGroceryType(place) {
  const types = place.types || [];
  return GROCERY_EXCLUDED_TYPES.some((t) => types.includes(t));
}

module.exports = { isExcludedGroceryType };
