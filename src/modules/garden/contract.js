'use strict';

// FR-092 — Garden / "What Will Grow" chapter -> headless report contract (rollout #13).
// A rich "Cool Things to Know" nature chapter: hardiness zone, native/invasive flora, local fauna,
// pollinator habitat, microclimate. All factual counts / categorical data.
//
// CONSTRAINT-001/008: species counts are observational facts (iNaturalist research-grade), not quality
// scores; favorable tone is an amenity signal (cf. recreation), never a composite rating. No graded
// label/color; the species `sci` (scientific name) is read into copy but not emitted as a key.
// Honest provenance: monarch/firefly are state-range models (modeled:true); counts/zone/elevation measured.
// Garden is discretionary nature info — absent data is OMITTED (no empty section), like recreation.

const { safeBuild } = require('../../contract/schema');

const names = (arr, n) => arr.slice(0, n).map((s) => s.name).join(', ');

function buildGardenContract(garden, opts = {}) {
  if (!garden) return null;
  const {
    hardinessZone, nativePlants = [], invasivePlants = [], wildlife = [], birds = [],
    butterflies = [], monarchCorridor, fireflyHabitat, microclimate,
  } = garden;

  const hasMonarch = !!monarchCorridor?.inCorridor;
  const hasFirefly = fireflyHabitat === true;
  const hasMicro = Number.isFinite(microclimate?.elevationFt);
  if (!hardinessZone && !nativePlants.length && !invasivePlants.length && !wildlife.length &&
      !birds.length && !butterflies.length && !hasMonarch && !hasFirefly && !hasMicro) {
    return null;
  }

  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const iNat = { source: 'iNaturalist', asOf, modeled: false };
  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // Generic species-count finding.
  const speciesFinding = (arr, { id, subject, tone, bucket = 'cool', lead, extra }) => {
    if (!arr.length) return;
    push({
      id, bucket, tone,
      claim: { subject, measure: { value: arr.length, unit: 'species' }, comparison: null },
      provenance: iNat,
      fallbackAction: null,
    }, `${lead} ${names(arr, 4)}.${extra ? ` ${extra(arr)}` : ''}`);
  };

  // ── Hardiness zone + frost (USDA) ───────────────────────────────────────────
  if (hardinessZone) {
    const frost = hardinessZone.frost;
    const copy = frost
      ? `USDA hardiness zone ${hardinessZone.zone}. Last spring frost lands around ${frost.lastSpring} and first fall frost around ${frost.firstFall} — a growing season of roughly ${frost.days} days.`
      : `USDA hardiness zone ${hardinessZone.zone}.`;
    push({
      id: 'hardiness-zone',
      bucket: 'cool',
      tone: 'neutral',
      claim: {
        subject: 'Plant hardiness zone',
        measure: frost && Number.isFinite(frost.days) ? { value: frost.days, unit: 'growing_season_days' } : null,
        comparison: null,
      },
      provenance: { source: 'USDA Plant Hardiness Zone Map', asOf, modeled: false },
      fallbackAction: null,
    }, copy);
  }

  // ── Flora ────────────────────────────────────────────────────────────────────
  speciesFinding(nativePlants, { id: 'native-plants', subject: 'Native plant species documented nearby', tone: 'favorable', lead: 'Native species observed nearby include' });
  speciesFinding(invasivePlants, {
    id: 'invasive-plants', subject: 'Invasive plant species documented nearby', tone: 'neutral', bucket: 'check',
    lead: 'Invasive species reported nearby include', extra: () => 'Worth identifying and managing early — they spread into gardens and crowd out natives.',
  });

  // ── Fauna ──────────────────────────────────────────────────────────────────
  speciesFinding(birds, { id: 'local-birds', subject: 'Bird species documented nearby', tone: 'favorable', lead: 'Birds observed nearby include' });
  speciesFinding(butterflies, { id: 'butterflies', subject: 'Butterfly species documented nearby', tone: 'favorable', lead: 'Butterflies and pollinators observed nearby include' });
  speciesFinding(wildlife, {
    id: 'local-wildlife', subject: 'Wildlife documented nearby', tone: 'neutral',
    lead: 'Wildlife observed nearby includes',
    extra: (arr) => (arr.some((w) => /deer/i.test(w.name)) ? 'Deer are active nearby — plan vegetable or ornamental plantings with deer-resistant species or fencing.' : ''),
  });

  // ── Pollinator habitat (state-range models) ─────────────────────────────────
  if (hasMonarch) {
    const milkweeds = (monarchCorridor.milkweedSpecies || []).join(', ');
    push({
      id: 'monarch-corridor',
      bucket: 'cool',
      tone: 'favorable',
      claim: { subject: 'On the monarch migration corridor', measure: null, comparison: null },
      provenance: { source: 'Xerces Society (state range)', asOf, modeled: true },
      fallbackAction: null,
    }, `This address sits within the monarch butterfly migration corridor.${milkweeds ? ` Milkweed species that support them here: ${milkweeds}.` : ''}`);
  }
  if (hasFirefly) {
    push({
      id: 'firefly-habitat',
      bucket: 'cool',
      tone: 'favorable',
      claim: { subject: 'Firefly habitat range', measure: null, comparison: null },
      provenance: { source: 'Firefly range (state)', asOf, modeled: true },
      fallbackAction: null,
    }, 'This region is within firefly habitat range — leaving leaf litter and limiting outdoor lighting helps them thrive.');
  }

  // ── Microclimate (elevation + solar geometry) ───────────────────────────────
  if (hasMicro) {
    const m = microclimate;
    const solar = Number.isFinite(m.solarSummerDeg) && Number.isFinite(m.solarWinterDeg)
      ? ` The midday sun reaches about ${m.solarSummerDeg}° above the horizon in late June and ${m.solarWinterDeg}° in late December — the low winter angle means south-side fences and hedges cast long midday shadows across a garden.`
      : '';
    push({
      id: 'microclimate',
      bucket: 'cool',
      tone: 'neutral',
      claim: { subject: 'Site elevation & sun exposure', measure: { value: Math.round(m.elevationFt), unit: 'feet' }, comparison: null },
      provenance: { source: 'USGS elevation', asOf, modeled: false },
      fallbackAction: null,
    }, `This address sits at roughly ${Math.round(m.elevationFt / 10) * 10} feet elevation.${solar}`);
  }

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('garden', () => ({
    schemaVersion: '1.0',
    chapterId: 'garden',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildGardenContract };
