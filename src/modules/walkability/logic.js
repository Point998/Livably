'use strict';

function getWalkCategory(score) {
  if (score >= 90) return { label: "Walker's Paradise", color: 'green', description: 'Daily errands do not require a car.' };
  if (score >= 70) return { label: 'Very Walkable', color: 'lightgreen', description: 'Most errands can be done on foot.' };
  if (score >= 50) return { label: 'Somewhat Walkable', color: 'gold', description: 'Some errands can be done on foot.' };
  if (score >= 25) return { label: 'Car-Dependent', color: 'orange', description: 'Most errands require a car.' };
  return { label: 'Very Car-Dependent', color: 'red', description: 'Almost all errands require a car.' };
}

// FR-067 — the band shown when no source could compute a score (Google outage
// AND OSM empty/down). Keeps the score vocabulary in one place; the template
// renders an actionable Walk Score pointer instead of a number (CONSTRAINT-015).
const UNKNOWN_WALK_CATEGORY = { label: 'Walkability Unavailable', color: 'gold', description: 'Could not estimate walkability — verify with the tools below.' };

// FR-067 — classify an OSM POI's raw tags into one of the WALK_TYPES categories
// (or null to discard). Tag-only inspection mirroring OSM_WALK_FILTERS — the one
// place the OSM tag→walk-category rule lives (CONSTRAINT-004: no brand/name).
function categorizeOSMWalkPOI(tags) {
  if (!tags) return null;
  if (tags.shop === 'supermarket' || tags.shop === 'grocery') return 'grocery';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.public_transport === 'station' || tags.public_transport === 'platform') return 'transit';
  if (tags.highway === 'bus_stop') return 'transit';
  if (tags.railway === 'station' || tags.railway === 'tram_stop') return 'transit';
  if (tags.leisure === 'park') return 'park';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  return null;
}

module.exports = { getWalkCategory, UNKNOWN_WALK_CATEGORY, categorizeOSMWalkPOI };
