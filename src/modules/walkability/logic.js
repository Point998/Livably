'use strict';

function getWalkCategory(score) {
  if (score >= 90) return { label: "Walker's Paradise", color: 'green', description: 'Daily errands do not require a car.' };
  if (score >= 70) return { label: 'Very Walkable', color: 'lightgreen', description: 'Most errands can be done on foot.' };
  if (score >= 50) return { label: 'Somewhat Walkable', color: 'gold', description: 'Some errands can be done on foot.' };
  if (score >= 25) return { label: 'Car-Dependent', color: 'orange', description: 'Most errands require a car.' };
  return { label: 'Very Car-Dependent', color: 'red', description: 'Almost all errands require a car.' };
}

module.exports = { getWalkCategory };
