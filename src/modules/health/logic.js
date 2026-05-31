'use strict';

// Returns true for places that are primarily a pharmacy, drug store, or retail store —
// indicating an in-store health clinic rather than a standalone urgent care facility.
function isRetailEmbeddedHealth(place) {
  const types = place.types || [];
  return types.includes('pharmacy') ||
         types.includes('drug_store') ||
         types.includes('store') ||
         types.includes('supermarket') ||
         types.includes('grocery_or_supermarket');
}

module.exports = { isRetailEmbeddedHealth };
