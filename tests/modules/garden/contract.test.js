'use strict';

// FR-092 — garden contract builder (rollout #13). "What Will Grow" nature chapter — factual counts /
// categorical; cool findings. No scores (CONSTRAINT-001).

const { buildGardenContract } = require('../../../src/modules/garden/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const sp = (name, sci) => ({ name, sci });
const full = {
  hardinessZone: { zone: '6b', frost: { lastSpring: 'April 15', firstFall: 'October 20', days: 188 } },
  nativePlants: [sp('Purple Coneflower', 'Echinacea purpurea'), sp('Butterfly Weed', 'Asclepias tuberosa'), sp('Wild Bergamot', 'Monarda fistulosa'), sp('Black-eyed Susan', 'Rudbeckia hirta'), sp('Little Bluestem', 'Schizachyrium scoparium')],
  invasivePlants: [sp('Bush Honeysuckle', 'Lonicera maackii'), sp('Garlic Mustard', 'Alliaria petiolata')],
  wildlife: [sp('White-tailed Deer', 'Odocoileus virginianus'), sp('Eastern Gray Squirrel', 'Sciurus carolinensis')],
  birds: [sp('Northern Cardinal', 'Cardinalis cardinalis'), sp('American Robin', 'Turdus migratorius'), sp('Carolina Wren', 'Thryothorus ludovicianus')],
  butterflies: [sp('Monarch', 'Danaus plexippus'), sp('Eastern Tiger Swallowtail', 'Papilio glaucus')],
  monarchCorridor: { inCorridor: true, milkweedSpecies: ['Common Milkweed', 'Butterfly Weed'] },
  fireflyHabitat: true,
  microclimate: { lat: 38.2, elevationFt: 910, solarSummerDeg: 74, solarWinterDeg: 28 },
};

const findById = (c, id) => c.findings.find((f) => f.id === id);

describe('buildGardenContract', () => {
  test('nothing present -> null (AC-9)', () => {
    expect(buildGardenContract({ hardinessZone: null, nativePlants: [], invasivePlants: [], wildlife: [], birds: [], butterflies: [], monarchCorridor: { inCorridor: false }, fireflyHabitat: false, microclimate: null }, ASOF)).toBeNull();
    expect(buildGardenContract(null, ASOF)).toBeNull();
  });

  test('full input: schema-valid, chapterId/version (AC-1)', () => {
    const c = buildGardenContract(full, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('garden');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('hardiness-zone: growing_season_days measure, zone+frost in copy (AC-2)', () => {
    const h = findById(buildGardenContract(full, ASOF), 'hardiness-zone');
    expect(h.claim.measure).toEqual({ value: 188, unit: 'growing_season_days' });
    expect(h.bucket).toBe('cool');
    expect(h.defaultCopy).toContain('6b');
    expect(h.defaultCopy).toContain('April 15');
    expect(h.provenance).toMatchObject({ source: 'USDA Plant Hardiness Zone Map', modeled: false });
  });

  test('native-plants / birds / butterflies: species count, cool/favorable, examples (AC-3)', () => {
    const c = buildGardenContract(full, ASOF);
    const n = findById(c, 'native-plants');
    expect(n.claim.measure).toEqual({ value: 5, unit: 'species' });
    expect(n.bucket).toBe('cool');
    expect(n.tone).toBe('favorable');
    expect(n.defaultCopy).toContain('Purple Coneflower');
    expect(findById(c, 'local-birds').claim.measure.value).toBe(3);
    expect(findById(c, 'butterflies').tone).toBe('favorable');
  });

  test('local-wildlife: neutral; deer note when deer present (AC-4)', () => {
    const w = findById(buildGardenContract(full, ASOF), 'local-wildlife');
    expect(w.tone).toBe('neutral');
    expect(w.defaultCopy.toLowerCase()).toMatch(/deer/);
  });

  test('invasive-plants: check bucket, count measure, heads-up copy (AC-5)', () => {
    const i = findById(buildGardenContract(full, ASOF), 'invasive-plants');
    expect(i.bucket).toBe('check');
    expect(i.claim.measure).toEqual({ value: 2, unit: 'species' });
    expect(i.defaultCopy).toContain('Bush Honeysuckle');
  });

  test('monarch-corridor / firefly-habitat: only when present, modeled:true (AC-6)', () => {
    const c = buildGardenContract(full, ASOF);
    expect(findById(c, 'monarch-corridor').provenance.modeled).toBe(true);
    expect(findById(c, 'monarch-corridor').defaultCopy).toContain('Milkweed');
    expect(findById(c, 'firefly-habitat').tone).toBe('favorable');
    // absent
    const none = buildGardenContract({ ...full, monarchCorridor: { inCorridor: false }, fireflyHabitat: false }, ASOF);
    expect(findById(none, 'monarch-corridor')).toBeUndefined();
    expect(findById(none, 'firefly-habitat')).toBeUndefined();
  });

  test('microclimate: elevation measure, solar note in copy (AC-7)', () => {
    const m = findById(buildGardenContract(full, ASOF), 'microclimate');
    expect(m.claim.measure).toEqual({ value: 910, unit: 'feet' });
    expect(m.defaultCopy.toLowerCase()).toMatch(/sun|shadow|horizon/);
  });

  test('empty species arrays omit their findings; no score/leak (AC-8, CONSTRAINT-001/008)', () => {
    const c = buildGardenContract({ ...full, butterflies: [], birds: [] }, ASOF);
    expect(findById(c, 'butterflies')).toBeUndefined();
    expect(findById(c, 'local-birds')).toBeUndefined();
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
    }
    const json = JSON.stringify(buildGardenContract(full, ASOF));
    for (const key of ['"color"', '"sci"']) expect(json).not.toContain(key);
  });

  test('provenanceSummary dedupes', () => {
    const sources = buildGardenContract(full, ASOF).provenanceSummary.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toContain('iNaturalist');
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildGardenContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-full': full,
    'bozeman-mt-different-zone': {
      hardinessZone: { zone: '5a', frost: { lastSpring: 'May 25', firstFall: 'September 15', days: 113 } },
      nativePlants: [sp('Arrowleaf Balsamroot', 'Balsamorhiza sagittata'), sp('Blue Flax', 'Linum lewisii')],
      invasivePlants: [sp('Spotted Knapweed', 'Centaurea stoebe')],
      wildlife: [sp('Mule Deer', 'Odocoileus hemionus')],
      birds: [sp('Mountain Bluebird', 'Sialia currucoides')],
      butterflies: [],
      monarchCorridor: { inCorridor: false },
      fireflyHabitat: false,
      microclimate: { lat: 45.7, elevationFt: 4820, solarSummerDeg: 67, solarWinterDeg: 21 },
    },
    'jeffersonville-in': {
      hardinessZone: { zone: '6b', frost: { lastSpring: 'April 18', firstFall: 'October 22', days: 187 } },
      nativePlants: [sp('Wild Columbine', 'Aquilegia canadensis')],
      invasivePlants: [],
      wildlife: [],
      birds: [sp('Blue Jay', 'Cyanocitta cristata')],
      butterflies: [sp('Monarch', 'Danaus plexippus')],
      monarchCorridor: { inCorridor: true, milkweedSpecies: ['Swamp Milkweed'] },
      fireflyHabitat: true,
      microclimate: { lat: 38.3, elevationFt: 455, solarSummerDeg: 75, solarWinterDeg: 28 },
    },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildGardenContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
