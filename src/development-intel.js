'use strict';

// Manual development intelligence database
// Keyed by "city,state" (lowercase). Add entries as new projects are confirmed.
//
// Status values: 'Under Construction' | 'Approved' | 'Planned'
// Only include confirmed, sourced projects — no speculation.

const DATABASE = {
  'georgetown,ky': [
    {
      name:     'Publix Supermarket',
      type:     'Grocery Store',
      status:   'Under Construction',
      timeline: 'Q4 2026',
      icon:     '🛒',
      impact:   'A full-service Publix is currently under construction in Georgetown — bringing a major grocery chain known for prepared foods and specialty departments to the area. Once open, this significantly expands grocery options for residents.',
    },
    {
      name:     'Target',
      type:     'Major Retail',
      status:   'Approved',
      timeline: 'Early 2027',
      icon:     '🏪',
      impact:   'A new Target store has received approval in Georgetown, expected to open in early 2027. This will bring full-service general merchandise — grocery, pharmacy, apparel, and home goods — to the local retail landscape.',
    },
  ],
};

function getLocalDevelopmentIntel(city, state) {
  if (!city || !state) return [];
  const key = `${city.toLowerCase().trim()},${state.toLowerCase().trim()}`;
  return DATABASE[key] || [];
}

module.exports = { getLocalDevelopmentIntel };
