'use strict';
const {
  SCHOOL_PLACE_TYPES, SCHOOL_NAME_TERMS,
} = require('../../utils/constants');

function isExcludedPlaceName(name, excludeTerms) {
  const normalized = (name || '').toLowerCase();
  return excludeTerms.some((term) => normalized.includes(term));
}

function isValidSchoolPlace(p) {
  const hasSchoolType = (p.types || []).some((t) => SCHOOL_PLACE_TYPES.has(t));
  const hasSchoolName = SCHOOL_NAME_TERMS.test(p.name || '');
  return hasSchoolType && hasSchoolName;
}

module.exports = { isExcludedPlaceName, isValidSchoolPlace };
