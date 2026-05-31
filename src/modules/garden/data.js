'use strict';

const {
  FROST_DATE_TABLE,
  INAT_NATIVE_PLANTS_RADIUS_KM, INAT_INVASIVE_PLANTS_RADIUS_KM,
  INAT_WILDLIFE_RADIUS_KM, INAT_BIRDS_RADIUS_KM,
  INAT_NATIVE_PLANTS_PER_PAGE, INAT_INVASIVE_PLANTS_PER_PAGE,
  INAT_WILDLIFE_PER_PAGE, INAT_BIRDS_PER_PAGE,
  INAT_REPTILES_RADIUS_KM, INAT_REPTILES_PER_PAGE,
  INAT_INSECTS_RADIUS_KM, INAT_INSECTS_PER_PAGE,
  INAT_BUTTERFLIES_RADIUS_KM, INAT_BUTTERFLIES_PER_PAGE,
} = require('../../utils/constants');

const {
  filterNativePlants, filterInvasivePlants, filterWildlife, filterBirds,
  filterReptiles, filterInsects, filterButterflies,
  categorizeSeasonalBirds, categorizePlantsByForm,
  getMonarchCorridorInfo, getFireflyHabitat,
} = require('./logic');

async function getHardinessZone(zip) {
  if (!zip) return null;
  try {
    const resp = await fetch(`https://phzmapi.org/${encodeURIComponent(zip)}.json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.zone) return null;
    const zone = data.zone.toLowerCase().trim();
    const frost = FROST_DATE_TABLE[zone] || FROST_DATE_TABLE[zone.replace(/[ab]$/, '')] || null;
    return {
      zone: data.zone,
      tempRange: data.temperature_range || null,
      frost,
    };
  } catch {
    return null;
  }
}

async function iNatSpeciesCounts(lat, lng, radiusKm, taxonId, flags, perPage) {
  try {
    const params = new URLSearchParams({
      lat: lat.toFixed(4),
      lng: lng.toFixed(4),
      radius: radiusKm,
      taxon_id: taxonId,
      quality_grade: 'research',
      per_page: perPage,
      order_by: 'count',
    });
    if (flags.native)     params.set('native', 'true');
    if (flags.introduced) params.set('introduced', 'true');
    const resp = await fetch(`https://api.inaturalist.org/v1/observations/species_counts?${params}`, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function iNatSeasonalBirds(lat, lng, months) {
  try {
    const params = new URLSearchParams({
      lat: lat.toFixed(4),
      lng: lng.toFixed(4),
      radius: INAT_BIRDS_RADIUS_KM,
      taxon_id: 3,
      quality_grade: 'research',
      per_page: 20,
      order_by: 'count',
      months,
    });
    const resp = await fetch(`https://api.inaturalist.org/v1/observations/species_counts?${params}`, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function getGardenData(lat, lng, locationInfo) {
  const zip = locationInfo?.zip || '';
  const state = locationInfo?.state || null;

  const [
    zoneRes, nativePlantsRes, invasivePlantsRes, wildlifeRes, birdsRes,
    reptilesRes, insectsRes, butterfliesRes,
    birdSpringRes, birdSummerRes, birdFallRes, birdWinterRes,
  ] = await Promise.allSettled([
    getHardinessZone(zip),
    iNatSpeciesCounts(lat, lng, INAT_NATIVE_PLANTS_RADIUS_KM,    47126, { native: true },     INAT_NATIVE_PLANTS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_INVASIVE_PLANTS_RADIUS_KM,  47126, { introduced: true }, INAT_INVASIVE_PLANTS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_WILDLIFE_RADIUS_KM,          40151, {},                  INAT_WILDLIFE_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_BIRDS_RADIUS_KM,             3,    {},                  INAT_BIRDS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_REPTILES_RADIUS_KM,          26036, {},                  INAT_REPTILES_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_INSECTS_RADIUS_KM,           47158, {},                  INAT_INSECTS_PER_PAGE),
    iNatSpeciesCounts(lat, lng, INAT_BUTTERFLIES_RADIUS_KM,       47224, {},                  INAT_BUTTERFLIES_PER_PAGE),
    iNatSeasonalBirds(lat, lng, '3,4,5'),
    iNatSeasonalBirds(lat, lng, '6,7,8'),
    iNatSeasonalBirds(lat, lng, '9,10,11'),
    iNatSeasonalBirds(lat, lng, '12,1,2'),
  ]);

  const val = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback;
  const rawNativePlants = val(nativePlantsRes, []);
  const filteredNativePlants = filterNativePlants(rawNativePlants);

  return {
    hardinessZone:  val(zoneRes, null),
    nativePlants:   filteredNativePlants,
    invasivePlants: filterInvasivePlants(val(invasivePlantsRes, [])),
    wildlife:       filterWildlife(val(wildlifeRes, [])),
    birds:          filterBirds(val(birdsRes, [])),
    nativePlantsByForm: categorizePlantsByForm(filteredNativePlants),
    reptiles:       filterReptiles(val(reptilesRes, [])),
    insects:        filterInsects(val(insectsRes, [])),
    butterflies:    filterButterflies(val(butterfliesRes, [])),
    birdsBySeason:  categorizeSeasonalBirds({
      spring: val(birdSpringRes, []),
      summer: val(birdSummerRes, []),
      fall:   val(birdFallRes, []),
      winter: val(birdWinterRes, []),
    }),
    monarchCorridor: getMonarchCorridorInfo(state),
    fireflyHabitat:  getFireflyHabitat(state),
  };
}

module.exports = {
  getGardenData,
  getHardinessZone,
  iNatSpeciesCounts,
  iNatSeasonalBirds,
  // Re-exported for backward compatibility (chapters.js imports these)
  filterNativePlants,
  filterInvasivePlants,
  filterWildlife,
  filterBirds,
  filterReptiles,
  filterInsects,
  filterButterflies,
  categorizeSeasonalBirds,
  categorizePlantsByForm,
  getMonarchCorridorInfo,
  getFireflyHabitat,
};
