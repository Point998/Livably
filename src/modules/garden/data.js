'use strict';

const {
  FROST_DATE_TABLE,
  NATIVE_PLANT_EXCLUDE, NATIVE_PLANT_EXCLUDE_NAMES,
  BENIGN_INTRODUCED, DOMESTIC_MAMMALS,
  INAT_NATIVE_PLANTS_RADIUS_KM, INAT_INVASIVE_PLANTS_RADIUS_KM,
  INAT_WILDLIFE_RADIUS_KM, INAT_BIRDS_RADIUS_KM,
  INAT_NATIVE_PLANTS_PER_PAGE, INAT_INVASIVE_PLANTS_PER_PAGE,
  INAT_WILDLIFE_PER_PAGE, INAT_BIRDS_PER_PAGE,
  INAT_REPTILES_RADIUS_KM, INAT_REPTILES_PER_PAGE,
  INAT_INSECTS_RADIUS_KM, INAT_INSECTS_PER_PAGE,
  INAT_BUTTERFLIES_RADIUS_KM, INAT_BUTTERFLIES_PER_PAGE,
  PLANT_GROWTH_FORMS, MONARCH_CORRIDOR_STATES, MILKWEED_BY_STATE, FIREFLY_STATES,
} = require('../../utils/constants');

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

function filterNativePlants(results) {
  return results
    .filter((r) => {
      const t = r.taxon;
      const sci = (t.name || '').toLowerCase();
      const common = (t.preferred_common_name || '').toLowerCase();
      if (!t.preferred_common_name) return false; // skip obscure species
      if (t.rank !== 'species') return false;
      // Exclude by genus or full species name
      const genus = sci.split(' ')[0];
      if (NATIVE_PLANT_EXCLUDE.has(sci) || NATIVE_PLANT_EXCLUDE.has(genus)) return false;
      // Exclude by common name keywords
      if (NATIVE_PLANT_EXCLUDE_NAMES.some((kw) => common.includes(kw))) return false;
      return true;
    })
    .slice(0, 6)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterInvasivePlants(results) {
  return results
    .filter((r) => {
      const t = r.taxon;
      const sci = (t.name || '').toLowerCase();
      if (!t.preferred_common_name) return false;
      if (t.rank !== 'species') return false;
      if (BENIGN_INTRODUCED.has(sci)) return false;
      return true;
    })
    .slice(0, 5)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterWildlife(results) {
  return results
    .filter((r) => {
      const sci = (r.taxon.name || '').toLowerCase();
      return r.taxon.preferred_common_name && !DOMESTIC_MAMMALS.has(sci);
    })
    .slice(0, 6)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterBirds(results) {
  return results
    .filter((r) => r.taxon.preferred_common_name)
    .slice(0, 6)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterReptiles(results) {
  return results
    .filter((r) => r.taxon.preferred_common_name)
    .slice(0, 8)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterInsects(results) {
  return results
    .filter((r) => r.taxon.preferred_common_name)
    .slice(0, 10)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function filterButterflies(results) {
  return results
    .filter((r) => r.taxon.preferred_common_name)
    .slice(0, 10)
    .map((r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count }));
}

function categorizeSeasonalBirds({ spring, summer, fall, winter }) {
  const seasonSets = [spring, summer, fall, winter].map(
    (arr) => new Set((arr || []).map((r) => r.taxon.name))
  );

  const countSeasons = (sciName) =>
    seasonSets.reduce((acc, s) => acc + (s.has(sciName) ? 1 : 0), 0);

  const allRaw = [...(spring || []), ...(summer || []), ...(fall || []), ...(winter || [])];
  const allSci = new Set(allRaw.map((r) => r.taxon.name));
  const yearRoundSci = new Set([...allSci].filter((s) => countSeasons(s) >= 3));

  const toEntry = (r) => ({ name: r.taxon.preferred_common_name, sci: r.taxon.name, count: r.count });
  const seen = new Set();

  const dedup = (arr) => {
    const out = [];
    for (const r of (arr || [])) {
      if (!seen.has(r.taxon.name) && r.taxon.preferred_common_name) {
        seen.add(r.taxon.name);
        out.push(toEntry(r));
      }
    }
    return out;
  };

  const yearRoundItems = dedup(allRaw.filter((r) => yearRoundSci.has(r.taxon.name))).slice(0, 8);

  const seasonal = (arr) => (arr || [])
    .filter((r) => !yearRoundSci.has(r.taxon.name) && r.taxon.preferred_common_name)
    .filter((r) => { if (seen.has(r.taxon.name)) return false; seen.add(r.taxon.name); return true; })
    .slice(0, 6)
    .map(toEntry);

  return {
    yearRound: yearRoundItems,
    spring: seasonal(spring),
    summer: seasonal(summer),
    fall: seasonal(fall),
    winter: seasonal(winter),
  };
}

function categorizePlantsByForm(nativePlants) {
  const trees = [], shrubs = [], perennials = [], grasses = [], vines = [];
  for (const p of nativePlants) {
    const form = PLANT_GROWTH_FORMS.get((p.sci || '').toLowerCase()) || 'perennial';
    if (form === 'tree') trees.push(p);
    else if (form === 'shrub') shrubs.push(p);
    else if (form === 'grass') grasses.push(p);
    else if (form === 'vine') vines.push(p);
    else perennials.push(p);
  }
  return { trees, shrubs, perennials, grasses, vines };
}

function getMonarchCorridorInfo(state) {
  const inCorridor = !!state && MONARCH_CORRIDOR_STATES.has(state);
  const milkweedSpecies = inCorridor
    ? (MILKWEED_BY_STATE[state] || MILKWEED_BY_STATE._default)
    : [];
  return { inCorridor, milkweedSpecies };
}

function getFireflyHabitat(state) {
  return !!state && FIREFLY_STATES.has(state);
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
