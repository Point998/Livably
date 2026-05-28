'use strict';
const {
  INAT_REPTILES_RADIUS_KM, INAT_REPTILES_PER_PAGE,
  INAT_INSECTS_RADIUS_KM, INAT_INSECTS_PER_PAGE,
  INAT_BUTTERFLIES_RADIUS_KM, INAT_BUTTERFLIES_PER_PAGE,
  PLANT_GROWTH_FORMS, MONARCH_CORRIDOR_STATES,
  MILKWEED_BY_STATE, FIREFLY_STATES,
} = require('../../src/utils/constants');

test('reptile iNat constants are defined', () => {
  expect(typeof INAT_REPTILES_RADIUS_KM).toBe('number');
  expect(typeof INAT_REPTILES_PER_PAGE).toBe('number');
});

test('insect iNat constants are defined', () => {
  expect(typeof INAT_INSECTS_RADIUS_KM).toBe('number');
  expect(typeof INAT_INSECTS_PER_PAGE).toBe('number');
});

test('butterfly iNat constants are defined', () => {
  expect(typeof INAT_BUTTERFLIES_RADIUS_KM).toBe('number');
  expect(typeof INAT_BUTTERFLIES_PER_PAGE).toBe('number');
});

test('PLANT_GROWTH_FORMS maps scientific names to growth form strings', () => {
  expect(PLANT_GROWTH_FORMS).toBeInstanceOf(Map);
  expect(['tree', 'shrub', 'perennial', 'grass', 'vine']).toContain(
    PLANT_GROWTH_FORMS.get('cercis canadensis')
  );
  expect(['tree', 'shrub', 'perennial', 'grass', 'vine']).toContain(
    PLANT_GROWTH_FORMS.get('solidago canadensis')
  );
});

test('MONARCH_CORRIDOR_STATES is a Set containing KY but not MT', () => {
  expect(MONARCH_CORRIDOR_STATES).toBeInstanceOf(Set);
  expect(MONARCH_CORRIDOR_STATES.has('KY')).toBe(true);
  expect(MONARCH_CORRIDOR_STATES.has('MT')).toBe(false);
});

test('MILKWEED_BY_STATE has entries for KY and IN', () => {
  expect(Array.isArray(MILKWEED_BY_STATE['KY'])).toBe(true);
  expect(MILKWEED_BY_STATE['KY'].length).toBeGreaterThan(0);
});

test('FIREFLY_STATES contains KY but not MT or OR', () => {
  expect(FIREFLY_STATES).toBeInstanceOf(Set);
  expect(FIREFLY_STATES.has('KY')).toBe(true);
  expect(FIREFLY_STATES.has('MT')).toBe(false);
  expect(FIREFLY_STATES.has('OR')).toBe(false);
});

// ── Filter function tests ─────────────────────────────────────────────────────

const makeInatResult = (commonName, sciName, count = 10) => ({
  count,
  taxon: { preferred_common_name: commonName, name: sciName, rank: 'species' },
});

const {
  filterReptiles, filterInsects, filterButterflies,
  categorizeSeasonalBirds, categorizePlantsByForm,
  getMonarchCorridorInfo, getFireflyHabitat,
} = require('../../src/chapters');

describe('filterReptiles', () => {
  test('returns named species', () => {
    const results = [makeInatResult('Eastern Box Turtle', 'Terrapene carolina')];
    expect(filterReptiles(results)).toEqual([{ name: 'Eastern Box Turtle', sci: 'Terrapene carolina', count: 10 }]);
  });

  test('excludes results with no common name', () => {
    const results = [makeInatResult('', 'Unknown sp.')];
    expect(filterReptiles(results)).toHaveLength(0);
  });
});

describe('filterInsects', () => {
  test('returns named insect species', () => {
    const results = [makeInatResult('Monarch Butterfly', 'Danaus plexippus')];
    expect(filterInsects(results)[0].name).toBe('Monarch Butterfly');
  });
});

describe('filterButterflies', () => {
  test('returns named butterfly species', () => {
    const results = [makeInatResult('Eastern Tiger Swallowtail', 'Papilio glaucus')];
    expect(filterButterflies(results)[0].name).toBe('Eastern Tiger Swallowtail');
  });
});

describe('categorizeSeasonalBirds', () => {
  const cardinal = makeInatResult('Northern Cardinal', 'Cardinalis cardinalis', 50);
  const warbler  = makeInatResult('Yellow Warbler', 'Setophaga petechia', 20);

  test('birds in 3+ seasons classified as yearRound', () => {
    const seasonal = {
      spring: [cardinal, warbler], summer: [cardinal], fall: [cardinal], winter: [cardinal],
    };
    const result = categorizeSeasonalBirds(seasonal);
    expect(result.yearRound.some((b) => b.name === 'Northern Cardinal')).toBe(true);
    expect(result.spring.some((b) => b.name === 'Yellow Warbler')).toBe(true);
  });

  test('returns empty arrays when input is empty', () => {
    const result = categorizeSeasonalBirds({ spring: [], summer: [], fall: [], winter: [] });
    expect(result.yearRound).toHaveLength(0);
    expect(result.spring).toHaveLength(0);
  });
});

describe('categorizePlantsByForm', () => {
  test('classifies cercis canadensis as tree', () => {
    const plants = [{ name: 'Eastern Redbud', sci: 'Cercis canadensis', count: 10 }];
    const result = categorizePlantsByForm(plants);
    expect(result.trees.some((p) => p.name === 'Eastern Redbud')).toBe(true);
  });

  test('classifies solidago canadensis as perennial', () => {
    const plants = [{ name: 'Goldenrod', sci: 'Solidago canadensis', count: 10 }];
    const result = categorizePlantsByForm(plants);
    expect(result.perennials.some((p) => p.name === 'Goldenrod')).toBe(true);
  });

  test('puts unknown species in perennials by default', () => {
    const plants = [{ name: 'Mystery Plant', sci: 'Unknown mysterius', count: 5 }];
    const result = categorizePlantsByForm(plants);
    expect(result.perennials.some((p) => p.name === 'Mystery Plant')).toBe(true);
  });
});

describe('getMonarchCorridorInfo', () => {
  test('returns inCorridor true for KY', () => {
    const result = getMonarchCorridorInfo('KY');
    expect(result.inCorridor).toBe(true);
    expect(Array.isArray(result.milkweedSpecies)).toBe(true);
    expect(result.milkweedSpecies.length).toBeGreaterThan(0);
  });

  test('returns inCorridor false for MT', () => {
    expect(getMonarchCorridorInfo('MT').inCorridor).toBe(false);
  });

  test('returns inCorridor false for null state', () => {
    expect(getMonarchCorridorInfo(null).inCorridor).toBe(false);
  });
});

describe('getFireflyHabitat', () => {
  test('returns true for KY', () => {
    expect(getFireflyHabitat('KY')).toBe(true);
  });

  test('returns false for MT', () => {
    expect(getFireflyHabitat('MT')).toBe(false);
  });
});
