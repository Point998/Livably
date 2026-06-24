'use strict';

// FR-094 — Climate chapter -> headless report contract (rollout #15, the genuinely last chapter).
//
// Scope is climateHistory ONLY. Flood / AQI / radon / noise / water / hazard-proximity are environment-owned
// (FR-090) and are NOT re-emitted here. Climate is value-neutral context: heat/cold days, disaster history,
// and watershed are descriptive facts (neutral tone, per growth FR-091); genuine cautions are reserved for
// high seismic ground motion and a lowpoint drainage position. External standard indices (USGS seismic pga,
// FEMA declarations, NOAA normals) are factual measures (external-index principle, FR-090) — never a composite
// climate score (CONSTRAINT-001). Honest provenance: NOAA normals are measured; the Open-Meteo fallback is
// modeled; the seismic narrative/band derive tone but are never emitted as a graded label.

const { safeBuild } = require('../../contract/schema');
const { getTornadoTier } = require('./logic');
const { CLIMATE_FEMA_LOOKBACK_YEARS } = require('../../utils/constants');

// band -> caution (mirrors getSeismicContext.promote: moderate and above)
const SEISMIC_CAUTION = new Set(['moderate', 'high', 'very-high']);
const TORNADO_TONE = { High: 'caution', Moderate: 'neutral', Low: 'favorable' };
const TORNADO_BUCKET = { High: 'check', Moderate: 'consider', Low: 'cool' };

function normalsProv(src, asOf) {
  return src === 'NOAA'
    ? { source: 'NOAA 30-yr normals', asOf, modeled: false }
    : { source: 'Open-Meteo ERA5 modeled normals', asOf, modeled: true };
}

const LOWPOINT_ASK = 'This address sits at a low point in the surrounding terrain — stormwater from uphill drains toward it. Ask the seller specifically whether the yard, basement, or crawlspace has taken on water during heavy rain.';

function buildClimateContract(climateHistory, opts = {}) {
  if (!climateHistory) return null;

  const { seismic, climateNormals, femaDeclarations, glance, watershed, preparedness } = climateHistory;
  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const state = opts.state || null;
  const county = opts.county || 'this county';
  const N = CLIMATE_FEMA_LOOKBACK_YEARS;

  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // ── Seismic ground motion (USGS standard index → factual measure; tone from band, label never emitted) ──
  if (seismic && Number.isFinite(seismic.pga)) {
    const caution = SEISMIC_CAUTION.has(seismic.band);
    push({
      id: 'seismic-hazard',
      bucket: caution ? 'check' : 'cool',
      tone: caution ? 'caution' : 'favorable',
      claim: { subject: 'Earthquake ground motion (USGS)', measure: { value: seismic.pga, unit: 'g_pga' }, comparison: null },
      provenance: { source: 'USGS ASCE 7-16', asOf, modeled: false },
      fallbackAction: null,
    }, seismic.narrative);
  }

  // ── Heat / cold days (NOAA normals — measured; Open-Meteo fallback — modeled) ──
  const ann = climateNormals?.annual;
  if (ann && Number.isFinite(ann.daysAbove90)) {
    push({
      id: 'hot-days', bucket: 'cool', tone: 'neutral',
      claim: { subject: 'Days per year at or above 90°F', measure: { value: ann.daysAbove90, unit: 'days_per_year' }, comparison: null },
      provenance: normalsProv(climateNormals.normalsSource, asOf),
      fallbackAction: null,
    });
  }
  if (ann && Number.isFinite(ann.daysBelow32)) {
    push({
      id: 'cold-days', bucket: 'cool', tone: 'neutral',
      claim: { subject: 'Days per year at or below 32°F', measure: { value: ann.daysBelow32, unit: 'days_per_year' }, comparison: null },
      provenance: normalsProv(climateNormals.normalsSource, asOf),
      fallbackAction: null,
    });
  }

  // ── Federal disaster history (FEMA; value-neutral — 0 is a genuine "cool thing to know") ──
  const count = femaDeclarations?.count || 0;
  const lastEvt = glance?.lastSignificantEvent;
  const disasterCopy = count === 0
    ? `No federally declared weather disasters in ${county} in the last ${N} years.`
    : `${county} has received ${count} federal weather-related disaster declaration${count === 1 ? '' : 's'} in the last ${N} years${lastEvt ? ` — most recently ${lastEvt.type} in ${lastEvt.year}` : ''}.`;
  push({
    id: 'disaster-history',
    bucket: count === 0 ? 'cool' : 'consider',
    tone: count === 0 ? 'favorable' : 'neutral',
    claim: { subject: 'Federal weather-disaster declarations (county)', measure: { value: count, unit: 'federal_disaster_declarations' }, comparison: null },
    provenance: { source: 'FEMA', asOf, modeled: false },
    fallbackAction: null,
  }, disasterCopy);

  // ── Tornado frequency (state tier; regional → modeled). Omit when state unknown. ──
  const t = state ? getTornadoTier(state) : null;
  if (t && t.tier !== 'Unknown') {
    push({
      id: 'tornado-frequency',
      bucket: TORNADO_BUCKET[t.tier],
      tone: TORNADO_TONE[t.tier],
      claim: { subject: 'Tornado frequency (state)', measure: null, comparison: null },
      provenance: { source: 'NOAA Storm Events (state averages)', asOf, modeled: true },
      fallbackAction: null,
    }, t.note);
  }

  // ── Topographic position (drainage-relevant; lowpoint = thing to check, uphill = advantage, midslope omitted) ──
  const pos = watershed?.topographicPosition;
  if (pos === 'lowpoint') {
    push({
      id: 'topographic-position', bucket: 'check', tone: 'caution',
      claim: { subject: 'Topographic position (drainage)', measure: null, comparison: null },
      provenance: { source: 'USGS elevation', asOf, modeled: false },
      fallbackAction: { type: 'instruction', label: 'Ask the seller about water intrusion', value: LOWPOINT_ASK },
    });
  } else if (pos === 'uphill') {
    push({
      id: 'topographic-position', bucket: 'cool', tone: 'favorable',
      claim: { subject: 'Topographic position (drainage)', measure: null, comparison: null },
      provenance: { source: 'USGS elevation', asOf, modeled: false },
      fallbackAction: null,
    }, 'This address sits above the surrounding terrain — stormwater drains away from rather than toward the parcel, a modest advantage in heavy rain.');
  }

  // ── Named watershed (a "cool thing to know") ──
  if (watershed?.named?.huc12Name) {
    const { huc12Name, basinName } = watershed.named;
    push({
      id: 'named-watershed', bucket: 'cool', tone: 'neutral',
      claim: { subject: 'Watershed (USGS)', measure: null, comparison: null },
      provenance: { source: 'USGS Watershed Boundary Dataset', asOf, modeled: false },
      fallbackAction: null,
    }, `This home sits in the ${huc12Name} watershed${basinName ? `, part of the ${basinName} basin` : ''}.`);
  }

  // ── Emergency alert registration (always actionable — CONSTRAINT-015) ──
  const es = preparedness?.emergencySystem;
  if (es) {
    const tier1 = es.tier === 1;
    push({
      id: 'emergency-alerts', bucket: 'check', tone: 'neutral',
      claim: { subject: 'Emergency alert registration', measure: null, comparison: null },
      provenance: { source: 'Local emergency management', asOf, modeled: false },
      fallbackAction: tier1
        ? { type: 'url', label: 'Register for emergency alerts', value: es.url }
        : { type: 'url', label: 'Find your county emergency alert registration', value: es.searchUrl },
    }, tier1 ? es.name : es.note);
  }

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('climate', () => ({
    schemaVersion: '1.0',
    chapterId: 'climate',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildClimateContract };
