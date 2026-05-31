'use strict';

// Chapter data module — FR-017 through FR-024

const { haversineDistance } = require('./utils/geo');

const { getCensusFIPS } = require('./shared/census');
const {
  getGardenData,
  filterReptiles, filterInsects, filterButterflies,
  categorizeSeasonalBirds, categorizePlantsByForm,
  getMonarchCorridorInfo, getFireflyHabitat,
} = require('./modules/garden/data');
const { getDemographics } = require('./modules/community/data');
const { getWalkabilityScore } = require('./modules/walkability/data');
const { getEmergencyServices, getSafetyLocationContext } = require('./modules/safety/data');
const {
  getClimateHistoryData,
  getEmergencySystem,
  getLastSignificantEvent,
  computeRarityStatement,
  classifyTopographicPosition,
  getWatershedContext,
  fetchElevationWithRetry,
} = require('./modules/climate/data');
const { getPropertyData, getPropertyIntelligence } = require('./modules/property/data');
const { getGrowthAndDevelopment } = require('./modules/growth/data');
const { getEnvironmentalData } = require('./modules/sensory/data');

const { buildClimateChapterHTML } = require('./templates/chapters/climate');
const { buildWhatWillGrowHTML } = require('./templates/chapters/garden');
const { buildSchoolRatingsHTML } = require('./templates/chapters/schools');
const { buildCrimeHTML } = require('./templates/chapters/safety');
const { buildSensoryEnvironmentalHTML } = require('./templates/chapters/sensory');
const { buildWalkabilityHTML } = require('./modules/walkability/template');
const { buildPropertyDataHTML } = require('./templates/chapters/costs');
const { buildDemographicsHTML } = require('./templates/chapters/community');
const { buildGrowthAndDevelopmentHTML } = require('./templates/chapters/growth');
const { buildPropertyIntelligenceHTML } = require('./templates/chapters/property');
const { buildHealthSafetyChapterHTML } = require('./modules/health/template');

// ── FR-017: Schools & Education ──────────────────────────────────────────────

async function getSchoolRatings(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime) {
  const publicSearches = [
    { level: 'Elementary', query: 'public elementary school', exclude: ['preschool','pre-school','daycare','montessori','private'] },
    { level: 'Middle',     query: 'middle school',            exclude: ['elementary','preschool'] },
    { level: 'High',       query: 'high school',              exclude: ['middle','elementary','junior high'] },
  ];

  const [publicResults, privateResult] = await Promise.allSettled([
    Promise.allSettled(
      publicSearches.map(async ({ level, query, exclude }) => {
        const resp = await googleMapsClient.textSearch({
          params: { key: googleMapsApiKey, query, location: `${lat},${lng}`, radius: 20000 },
        });
        const places = (resp.data.results || []).filter(
          (p) => !exclude.some((ex) => (p.name || '').toLowerCase().includes(ex))
        );
        const place = places[0];
        if (!place) return null;
        let driveTimeMinutes = null;
        try { driveTimeMinutes = await getDriveTime(originLatLng, place.geometry.location); } catch {}
        return {
          level,
          name: place.name,
          address: place.formatted_address || place.vicinity || place.name,
          distanceMiles: haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng).toFixed(1),
          driveTimeMinutes,
        };
      })
    ),
    googleMapsClient.textSearch({
      params: { key: googleMapsApiKey, query: 'private school', location: `${lat},${lng}`, radius: 16000 },
    }),
  ]);

  const publicSchools = publicResults.status === 'fulfilled'
    ? publicResults.value.map((r) => (r.status === 'fulfilled' ? r.value : null))
    : [];

  let privateSchools = [];
  if (privateResult.status === 'fulfilled') {
    const skipWords = ['preschool', 'pre-school', 'daycare', 'day care', 'montessori'];
    const places = (privateResult.value.data.results || [])
      .filter((p) => !skipWords.some((w) => (p.name || '').toLowerCase().includes(w)))
      .slice(0, 5);
    for (const place of places) {
      privateSchools.push({
        name: place.name,
        address: place.formatted_address || place.vicinity || place.name,
        distanceMiles: haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng).toFixed(1),
      });
    }
    privateSchools.sort((a, b) => parseFloat(a.distanceMiles) - parseFloat(b.distanceMiles));
  }

  if (!publicSchools.some(Boolean) && !privateSchools.length) return null;
  return { public: publicSchools, private: privateSchools };
}

// ── Master fetch ──────────────────────────────────────────────────────────────

async function getChapterData({ lat, lng, originLatLng, locationInfo, googleMapsClient, googleMapsApiKey, getDriveTime, highwayDriveMinutes, fips: prefetchedFips }) {
  const fips = prefetchedFips ?? await getCensusFIPS(lat, lng);

  const [demographics, propertyData, walkability, emergency, environment, safetyLocation, schools, growth, propIntel, gardenData, climateHistory] =
    await Promise.allSettled([
      getDemographics(lat, lng, fips),
      getPropertyData(fips, locationInfo),
      getWalkabilityScore(lat, lng),
      getEmergencyServices(lat, lng, originLatLng),
      getEnvironmentalData(lat, lng, highwayDriveMinutes, fips),
      getSafetyLocationContext(locationInfo),
      getSchoolRatings(lat, lng, originLatLng, googleMapsClient, googleMapsApiKey, getDriveTime),
      getGrowthAndDevelopment(lat, lng, fips, locationInfo),
      getPropertyIntelligence(lat, lng, fips, locationInfo),
      getGardenData(lat, lng, locationInfo),
      getClimateHistoryData(lat, lng, locationInfo, fips),
    ]);

  const val = (r) => (r.status === 'fulfilled' ? r.value : null);

  // Post-resolve basementContext: needs constructionEra + ruralMode, both only available after parallel fetch
  const { getBasementContext: gbc, detectRuralMode: drm } = require('./shared/validate');
  let climateHistoryVal = val(climateHistory);
  if (climateHistoryVal) {
    const era        = val(propIntel)?.era?.medianYearBuilt ? String(val(propIntel).era.medianYearBuilt) : null;
    const demog      = val(demographics);
    const tractPop   = demog?.totalPop ?? null;
    const avgDrive   = val(propertyData)?.avgDriveMinutes ?? null;
    const ruralMode  = (tractPop !== null ? drm(tractPop, avgDrive) : { mode: 'suburban' }).mode;
    climateHistoryVal = {
      ...climateHistoryVal,
      basementContext: gbc(era, locationInfo?.state, ruralMode),
    };
  }

  return {
    demographics: val(demographics),
    propertyData: val(propertyData),
    walkability:  val(walkability),
    emergency:    val(emergency),
    environment:  val(environment),
    safetyLocation: val(safetyLocation),
    schools:      val(schools),
    growth:       val(growth),
    propIntel:    val(propIntel),
    gardenData:   val(gardenData),
    climateHistory: climateHistoryVal,
    locationInfo,
  };
}

// ── HTML builders ──────────────────────────────────────────────────────────────

function buildChaptersHTML(chapters) {
  if (!chapters) return '';
  return [
    buildSchoolRatingsHTML(chapters.schools),
    buildCrimeHTML(chapters.safetyLocation, chapters.emergency),
    buildDemographicsHTML(chapters.demographics),
    buildGrowthAndDevelopmentHTML(chapters.growth),
    buildClimateChapterHTML(chapters.environment, chapters.climateHistory, chapters.locationInfo),
    buildWhatWillGrowHTML(chapters.gardenData, chapters.propIntel?.soil, chapters.locationInfo),
    buildPropertyIntelligenceHTML(chapters.propIntel),
    buildSensoryEnvironmentalHTML(chapters.environment),
    buildWalkabilityHTML(chapters.walkability),
    buildPropertyDataHTML(chapters.propertyData),
  ].join('');
}

module.exports = {
  getChapterData, buildChaptersHTML,
  filterReptiles, filterInsects, filterButterflies,
  categorizeSeasonalBirds, categorizePlantsByForm,
  getMonarchCorridorInfo, getFireflyHabitat, getEmergencySystem,
  getLastSignificantEvent, computeRarityStatement, classifyTopographicPosition,
  getWatershedContext, fetchElevationWithRetry,
};
