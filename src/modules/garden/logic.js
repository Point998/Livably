'use strict';

const {
  NATIVE_PLANT_EXCLUDE, NATIVE_PLANT_EXCLUDE_NAMES,
  BENIGN_INTRODUCED, DOMESTIC_MAMMALS,
  PLANT_GROWTH_FORMS, MONARCH_CORRIDOR_STATES, MILKWEED_BY_STATE, FIREFLY_STATES,
} = require('../../utils/constants');

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

module.exports = {
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
