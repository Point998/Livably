'use strict';

// FR-090 — Environment chapter -> headless report contract (rollout #11).
// Maps getEnvironmentalData (sensory module) into the environmental HEALTH & SAFETY findings:
// flood, air quality, road noise, water quality, radon, hazard proximity. The sensory AMBIANCE items
// (airports / rail / light pollution) are a deferred follow-on.
//
// PRINCIPLE (applies to all remaining chapters): external standard indices — EPA AQI, FEMA flood zone,
// EPA radon zone, EPA EJSCREEN percentile, FHWA DNL — are FACTUAL external data, surfaced as measures
// with tone derived from their published category. This differs from a Livably-COMPUTED composite score
// (e.g. walkability, FR-089), which CONSTRAINT-001 forbids. The graded label/color are dropped
// (CONSTRAINT-008); .strict() rejects them.
//
// CONSTRAINT-002 (Fair Housing): EJSCREEN is surfaced as HAZARD PROXIMITY only (Superfund/RMP/TSDF
// facility percentiles) — never demographic indices (the data layer extracts only these). Honest
// provenance: state-level radon and estimated road noise are modeled:true.

const { safeBuild } = require('../../contract/schema');

function toneFromColor(color) {
  if (color === 'green' || color === 'lightgreen') return 'favorable';
  if (color === 'orange' || color === 'red') return 'caution';
  return 'neutral';
}

function floodTone(risk) {
  if (risk === 'Minimal') return 'favorable';
  if (risk === 'High' || risk === 'Very High') return 'caution';
  return 'neutral'; // Moderate / Unknown
}

// EPA radon zones: 1 = highest predicted indoor level, 3 = lowest.
function radonTone(zone) {
  if (zone === 1) return 'caution';
  if (zone === 3) return 'favorable';
  return 'neutral';
}

function buildEnvironmentContract(environment, opts = {}) {
  if (!environment) return null;
  const { airQuality, floodRisk, roadNoise, waterQuality, radon, ejscreen } = environment;
  if (!airQuality && !floodRisk && !roadNoise && !waterQuality && !radon && !ejscreen) return null;

  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // ── Flood risk (FEMA NFHL — parcel-level categorical) ───────────────────────
  if (floodRisk) {
    push({
      id: 'flood-risk',
      bucket: 'check',
      tone: floodTone(floodRisk.risk),
      claim: { subject: 'FEMA flood zone', measure: null, comparison: null },
      provenance: { source: 'FEMA NFHL', asOf, modeled: false },
      fallbackAction: null,
    }, `Zone ${floodRisk.zone}: ${floodRisk.description}${floodRisk.insuranceRequired ? ' Flood insurance is federally required for a mortgage here.' : ' Flood insurance is not federally required, though optional coverage is still worth pricing.'}`);
  } else {
    push({
      id: 'flood-risk-missing',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'FEMA flood zone', measure: null, comparison: null },
      provenance: { source: 'FEMA NFHL', asOf, modeled: false },
      fallbackAction: { type: 'url', label: 'Look up the parcel on the FEMA Flood Map', value: 'https://msc.fema.gov/portal/search' },
    });
  }

  // ── Air quality (EPA AirNow — AQI is an external standard index) ─────────────
  if (airQuality) {
    push({
      id: 'air-quality',
      bucket: 'consider',
      tone: toneFromColor(airQuality.category?.color),
      claim: { subject: 'Air quality index (AQI)', measure: { value: airQuality.aqi, unit: 'aqi' }, comparison: null },
      provenance: { source: 'EPA AirNow', asOf, modeled: false },
      fallbackAction: null,
    }, [airQuality.category?.description, airQuality.primaryPollutant ? `Primary pollutant: ${airQuality.primaryPollutant}.` : null].filter(Boolean).join(' ') || undefined);
  } else {
    push({
      id: 'air-quality-missing',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'Air quality index (AQI)', measure: null, comparison: null },
      provenance: { source: 'EPA AirNow', asOf, modeled: false },
      fallbackAction: { type: 'url', label: 'Check current AQI on AirNow', value: 'https://www.airnow.gov/' },
    });
  }

  // ── Road noise (FHWA DNL — measured BTS or modeled estimate) ─────────────────
  if (roadNoise) {
    const modeled = /estimated/i.test(roadNoise.source || '');
    push({
      id: 'road-noise',
      bucket: 'consider',
      tone: toneFromColor(roadNoise.category?.color),
      claim: { subject: 'Road noise (day-night level)', measure: { value: roadNoise.dnl, unit: 'dnl_db' }, comparison: null },
      provenance: { source: 'BTS / FHWA model', asOf, modeled },
      fallbackAction: null,
    }, [roadNoise.category?.hint ? `Noise here is ${roadNoise.category.hint}.` : null, modeled ? 'This level is modeled from nearby road proximity, not measured at the address — confirm by visiting at rush hour.' : null].filter(Boolean).join(' ') || undefined);
  }

  // ── Water quality (EPA SDWIS — recent violations) ───────────────────────────
  if (waterQuality) {
    const count = Array.isArray(waterQuality.violations) ? waterQuality.violations.length : 0;
    push({
      id: 'water-quality',
      bucket: 'check',
      tone: count > 0 ? 'caution' : 'favorable',
      claim: { subject: 'Public water system violations', measure: { value: count, unit: 'violation_count' }, comparison: null },
      provenance: { source: 'EPA SDWIS', asOf, modeled: false },
      fallbackAction: count > 0
        ? { type: 'url', label: 'Review violations on EPA ECHO', value: 'https://echo.epa.gov/' }
        : null,
    }, `${waterQuality.systemName || 'The local public water system'} ${count > 0 ? `has ${count} recent reported violation${count === 1 ? '' : 's'} — review the specifics and any resolution.` : 'has no recent reported drinking-water violations.'}`);
  } else {
    push({
      id: 'water-quality-missing',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'Public water system violations', measure: null, comparison: null },
      provenance: { source: 'EPA SDWIS', asOf, modeled: false },
      fallbackAction: { type: 'url', label: 'Look up the water system on EPA ECHO', value: 'https://echo.epa.gov/' },
    });
  }

  // ── Radon (EPA radon zones — STATE-level, coarse -> modeled) ─────────────────
  if (radon && Number.isFinite(radon.zone)) {
    push({
      id: 'radon',
      bucket: 'check',
      tone: radonTone(radon.zone),
      claim: { subject: 'EPA radon zone', measure: null, comparison: null },
      provenance: { source: 'EPA Radon Zones', asOf, modeled: true },
      fallbackAction: { type: 'instruction', label: 'Test this specific home for radon', value: 'EPA radon zones are county/state-level guidance, not an address measurement. A short-term radon test kit is inexpensive (~$15–$30) — test the actual home before closing, and ask the seller for any prior results.' },
    }, radon.zone === 1
      ? 'This area is EPA Radon Zone 1 (highest predicted indoor radon) — an address-specific test is strongly recommended.'
      : radon.zone === 3
        ? 'This area is EPA Radon Zone 3 (lowest predicted indoor radon) — still worth a one-time test, as radon varies home to home.'
        : 'This area is EPA Radon Zone 2 (moderate predicted indoor radon) — an address-specific test is recommended.');
  }

  // ── Hazard proximity (EPA EJSCREEN — Superfund/RMP/TSDF facility proximity) ──
  if (ejscreen) {
    const elevated = [];
    if (ejscreen.superfundPct > 75) elevated.push('Superfund-site proximity');
    if (ejscreen.rmpPct > 75) elevated.push('chemical-risk (RMP) facility proximity');
    if (ejscreen.tsdfPct > 75) elevated.push('hazardous-waste (TSDF) facility proximity');
    push({
      id: 'hazard-proximity',
      bucket: 'check',
      tone: ejscreen.flagged ? 'caution' : 'neutral',
      claim: { subject: 'Industrial / hazardous-site proximity', measure: null, comparison: null },
      provenance: { source: 'EPA EJSCREEN', asOf, modeled: false },
      fallbackAction: { type: 'url', label: 'See specific facilities on EPA ECHO', value: 'https://echo.epa.gov/' },
    }, ejscreen.flagged
      ? `This location is above the 75th national percentile for ${elevated.join(' and ')} — more nearby industrial or hazardous-site activity than most US residential locations. Review specific permitted facilities on EPA ECHO.`
      : 'Below the 75th national percentile for Superfund, chemical-risk, and hazardous-waste site proximity — no elevated industrial-hazard flags for this location.');
  }

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('environment', () => ({
    schemaVersion: '1.0',
    chapterId: 'environment',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildEnvironmentContract };
