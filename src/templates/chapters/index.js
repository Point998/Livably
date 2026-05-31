'use strict';

const { buildClimateChapterHTML } = require('./climate');
const { buildWhatWillGrowHTML } = require('./garden');
const { buildSchoolRatingsHTML } = require('./schools');
const { buildCrimeHTML, buildEmergencyServicesHTML } = require('./safety');
const { buildSensoryEnvironmentalHTML } = require('./sensory');
const { buildWalkabilityHTML } = require('./walkability');
const { buildPropertyDataHTML } = require('../../modules/costs/template');
const { buildDemographicsHTML } = require('./community');
const { buildGrowthAndDevelopmentHTML } = require('./growth');
const { buildPropertyIntelligenceHTML } = require('./property');
const { buildHealthSafetyChapterHTML } = require('../../modules/health/template');
const { buildInsightsCardHTML, buildCustomDestinationsCardHTML, buildAdditionalServicesCardHTML } = require('../../modules/reachability/template');
const { buildTrafficItemHTML, buildTrafficCardHTML } = require('../../modules/traffic/template');

module.exports = {
  buildClimateChapterHTML,
  buildWhatWillGrowHTML,
  buildSchoolRatingsHTML,
  buildCrimeHTML,
  buildEmergencyServicesHTML,
  buildSensoryEnvironmentalHTML,
  buildWalkabilityHTML,
  buildPropertyDataHTML,
  buildDemographicsHTML,
  buildGrowthAndDevelopmentHTML,
  buildPropertyIntelligenceHTML,
  buildHealthSafetyChapterHTML,
  buildInsightsCardHTML,
  buildCustomDestinationsCardHTML,
  buildAdditionalServicesCardHTML,
  buildTrafficItemHTML,
  buildTrafficCardHTML,
};
