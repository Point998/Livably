'use strict';

function getIncomeLevel(median) {
  if (!median || median <= 0) return { label: 'Data unavailable', color: 'muted' };
  if (median > 100000) return { label: 'Above $100k median', color: 'gold' };
  if (median > 70000) return { label: 'Above national median', color: 'gold' };
  if (median > 50000) return { label: 'Near national median', color: 'gold' };
  return { label: 'Below national median', color: 'gold' };
}

function getEducationLevel(collegePct) {
  if (collegePct > 60) return { label: 'Well above US avg', color: 'green' };
  if (collegePct > 40) return { label: 'Above US avg', color: 'lightgreen' };
  if (collegePct > 25) return { label: 'Near US avg', color: 'gold' };
  return { label: 'Below US avg', color: 'muted' };
}

function getDensityType(population) {
  if (population > 5000) return { label: 'Urban', icon: '🏙️' };
  if (population > 2000) return { label: 'Suburban', icon: '🏘️' };
  return { label: 'Rural', icon: '🌳' };
}

function getCommunityType(ownershipRate, householdSize) {
  if (ownershipRate > 70 && householdSize > 2.5) return { label: 'Owner-occupied, family-sized households', icon: '🏡' };
  if (ownershipRate < 40) return { label: 'Majority renter-occupied', icon: '🏢' };
  if (householdSize && householdSize < 2) return { label: 'Smaller households, higher mobility', icon: '👤' };
  return { label: 'Mixed residential community', icon: '🏘️' };
}

function suppressed(val) {
  const n = parseInt(val, 10);
  return (isNaN(n) || n < 0) ? null : n;
}

function groupIncomeBrackets(get) {
  const total = suppressed(get('B19001_001E'));
  if (!total || total === 0) return null;

  const buckets = [
    { label: 'Under $25k',   vars: ['B19001_002E','B19001_003E','B19001_004E','B19001_005E'] },
    { label: '$25k–$50k',    vars: ['B19001_006E','B19001_007E','B19001_008E','B19001_009E','B19001_010E'] },
    { label: '$50k–$75k',    vars: ['B19001_011E','B19001_012E'] },
    { label: '$75k–$100k',   vars: ['B19001_013E'] },
    { label: '$100k+',       vars: ['B19001_014E','B19001_015E','B19001_016E','B19001_017E'] },
  ];

  let hasSuppressed = false;
  const brackets = buckets.map(({ label, vars: names }) => {
    let count = 0;
    for (const n of names) {
      const v = suppressed(get(n));
      if (v === null) { hasSuppressed = true; }
      else { count += v; }
    }
    return { label, count, pct: Math.round(count / total * 100) };
  });

  return { totalHouseholds: total, brackets, hasSuppressed };
}

function buildEducationLadder(get) {
  const total = suppressed(get('B15003_001E'));
  if (!total || total === 0) return null;

  const hs     = suppressed(get('B15003_017E')) || 0;
  const ged    = suppressed(get('B15003_018E')) || 0;
  const sc1    = suppressed(get('B15003_019E')) || 0;
  const sc2    = suppressed(get('B15003_020E')) || 0;
  const assoc  = suppressed(get('B15003_021E')) || 0;
  const bach   = suppressed(get('B15003_022E')) || 0;
  const master = suppressed(get('B15003_023E')) || 0;
  const prof   = suppressed(get('B15003_024E')) || 0;
  const doc    = suppressed(get('B15003_025E')) || 0;

  const known  = hs + ged + sc1 + sc2 + assoc + bach + master + prof + doc;
  const lessHS = Math.max(0, total - known);
  const pct    = (n) => Math.round(n / total * 100);

  return {
    totalAdults: total,
    steps: [
      { label: 'Less than high school',       pct: pct(lessHS) },
      { label: 'High school / GED',           pct: pct(hs + ged) },
      { label: "Some college / Associate's",  pct: pct(sc1 + sc2 + assoc) },
      { label: "Bachelor's degree",           pct: pct(bach) },
      { label: 'Graduate degree',             pct: pct(master + prof + doc) },
    ],
  };
}

function buildHouseholdComposition(get) {
  const total = suppressed(get('B11001_001E'));
  if (!total || total === 0) return null;

  const family     = suppressed(get('B11001_002E')) || 0;
  const married    = suppressed(get('B11001_003E')) || 0;
  const maleSingle = suppressed(get('B11001_005E')) || 0;
  const femSingle  = suppressed(get('B11001_006E')) || 0;
  const nonfamily  = suppressed(get('B11001_007E')) || 0;
  const alone      = suppressed(get('B11001_008E')) || 0;
  const pct        = (n) => Math.round(n / total * 100);

  return {
    totalHouseholds: total,
    familyPct:       pct(family),
    marriedCouplePct: pct(married),
    singleParentPct:  pct(maleSingle + femSingle),
    nonfamilyPct:    pct(nonfamily),
    livingAlonePct:  pct(alone),
  };
}

function buildCommuteMode(get) {
  const total = suppressed(get('B08006_001E'));
  if (!total || total === 0) return null;

  const pct = (varName) => Math.round((suppressed(get(varName)) || 0) / total * 100);

  return {
    totalWorkers:  total,
    droveAlonePct: pct('B08006_002E'),
    carpoolPct:    pct('B08006_003E'),
    transitPct:    pct('B08006_008E'),
    bicyclePct:    pct('B08006_014E'),
    walkedPct:     pct('B08006_015E'),
    otherPct:      pct('B08006_016E'),
    wfhPct:        pct('B08006_017E'),
  };
}

function buildTractFips(fips) {
  if (!fips?.state || !fips?.county || !fips?.tract) return null;
  const state  = String(fips.state).padStart(2, '0');
  const county = String(fips.county).padStart(3, '0');
  const tract  = String(fips.tract).padStart(6, '0');
  return {
    state,
    county,
    tract,
    censusExplorerUrl: `https://data.census.gov/table?g=1400000US${state}${county}${tract}`,
  };
}

module.exports = { getIncomeLevel, getEducationLevel, getDensityType, getCommunityType, suppressed, groupIncomeBrackets, buildEducationLadder, buildHouseholdComposition, buildCommuteMode, buildTractFips };
