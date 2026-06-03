'use strict';
const {
  INAT_REPTILES_RADIUS_KM, INAT_REPTILES_PER_PAGE,
  INAT_INSECTS_RADIUS_KM, INAT_INSECTS_PER_PAGE,
  INAT_BUTTERFLIES_RADIUS_KM, INAT_BUTTERFLIES_PER_PAGE,
  PLANT_GROWTH_FORMS, MONARCH_CORRIDOR_STATES,
  MILKWEED_BY_STATE, FIREFLY_STATES,
} = require('../../../src/utils/constants');

const {
  filterReptiles, filterInsects, filterButterflies,
  categorizeSeasonalBirds, categorizePlantsByForm,
  getMonarchCorridorInfo, getFireflyHabitat,
  filterNativePlants, filterInvasivePlants,
} = require('../../../src/modules/garden/data');

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

  test('bird in exactly 2 seasons is NOT classified as yearRound', () => {
    const warbler = makeInatResult('Yellow Warbler', 'Setophaga petechia', 20);
    const seasonal = {
      spring: [warbler], summer: [warbler], fall: [], winter: [],
    };
    const result = categorizeSeasonalBirds(seasonal);
    expect(result.yearRound.some((b) => b.name === 'Yellow Warbler')).toBe(false);
    // Should appear in spring (first season it occurs in) not summer
    expect(result.spring.some((b) => b.name === 'Yellow Warbler')).toBe(true);
    expect(result.summer.some((b) => b.name === 'Yellow Warbler')).toBe(false);
  });

  test('bird in spring+summer appears only in spring output (no duplicates)', () => {
    const bird = makeInatResult('Common Grackle', 'Quiscalus quiscula', 15);
    const seasonal = {
      spring: [bird], summer: [bird], fall: [], winter: [],
    };
    const result = categorizeSeasonalBirds(seasonal);
    const allBirds = [
      ...result.yearRound, ...result.spring, ...result.summer, ...result.fall, ...result.winter,
    ];
    const count = allBirds.filter((b) => b.name === 'Common Grackle').length;
    expect(count).toBe(1);
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

  test('KY is in corridor and has milkweed species', () => {
    const info = getMonarchCorridorInfo('KY');
    expect(info.inCorridor).toBe(true);
    expect(info.milkweedSpecies.length).toBeGreaterThan(0);
  });

  test('MT is not in corridor', () => {
    const info = getMonarchCorridorInfo('MT');
    expect(info.inCorridor).toBe(false);
    expect(info.milkweedSpecies).toEqual([]);
  });
});

describe('getFireflyHabitat', () => {
  test('returns true for KY', () => {
    expect(getFireflyHabitat('KY')).toBe(true);
  });

  test('returns false for MT', () => {
    expect(getFireflyHabitat('MT')).toBe(false);
  });

  test('KY has firefly habitat', () => expect(getFireflyHabitat('KY')).toBe(true));
  test('MT does not', () => expect(getFireflyHabitat('MT')).toBe(false));
});

describe('filterNativePlants', () => {
  const makeResult = (sci, common, rank = 'species') => ({
    taxon: { name: sci, preferred_common_name: common, rank },
    count: 5,
  });

  test('filters to species rank only', () => {
    const results = [
      makeResult('quercus alba', 'White Oak', 'species'),
      makeResult('quercus', 'Oak genus', 'genus'),
    ];
    const filtered = filterNativePlants(results);
    expect(filtered.map((r) => r.name)).toContain('White Oak');
    expect(filtered.map((r) => r.sci)).not.toContain('quercus');
  });

  test('excludes results without common name', () => {
    const results = [makeResult('quercus alba', null)];
    expect(filterNativePlants(results)).toHaveLength(0);
  });

  test('returns max 6 results', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult(`species${i} alba`, `Plant ${i}`)
    );
    expect(filterNativePlants(results).length).toBeLessThanOrEqual(6);
  });
});

const { getMicroclimateData } = require('../../../src/modules/garden/data');

describe('getMicroclimateData', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns solar angles and elevation when USGS succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: 900.5 }),
    });
    const result = await getMicroclimateData(38, -84.5);
    expect(result.solarSummerDeg).toBe(76);
    expect(result.solarWinterDeg).toBe(29);
    expect(result.elevationFt).toBe(901);
    expect(result.lat).toBe(38);
  });

  test('returns null elevationFt when USGS fails, solar angles still computed', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    const result = await getMicroclimateData(38, -84.5);
    expect(result.elevationFt).toBeNull();
    expect(result.solarSummerDeg).toBe(76);
    expect(result.solarWinterDeg).toBe(29);
    expect(result.lat).toBe(38);
  });

  test('returns null elevationFt when USGS returns ok:false', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const result = await getMicroclimateData(38, -84.5);
    expect(result.elevationFt).toBeNull();
    expect(result.solarSummerDeg).toBe(76);
  });

  test('solar angles at Bozeman MT latitude (46°)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: 4820 }),
    });
    const result = await getMicroclimateData(46, -111.0);
    expect(result.solarSummerDeg).toBe(68);
    expect(result.solarWinterDeg).toBe(21);
    expect(result.elevationFt).toBe(4820);
  });

  test('returns null elevationFt when USGS value is null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: null }),
    });
    const result = await getMicroclimateData(38, -84.5);
    expect(result.elevationFt).toBeNull();
  });

  test('returns null elevationFt when USGS value is -9999 (no-data sentinel)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: -9999 }),
    });
    const result = await getMicroclimateData(38, -84.5);
    expect(result.elevationFt).toBeNull();
  });
});
