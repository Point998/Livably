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
