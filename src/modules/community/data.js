'use strict';

const { fetchCensusACS } = require('../../shared/census');
const { safeInt } = require('../../utils/text');
const { getIncomeLevel, getEducationLevel, getDensityType, getCommunityType, suppressed, groupIncomeBrackets, buildEducationLadder, buildHouseholdComposition, buildCommuteMode, buildTractFips } = require('./logic');

async function getDemographics(lat, lng, fips) {
  if (!fips) return null;

  // Split into two batches — Census ACS limit is 50 variables per request
  const varsBatch1 = [
    'B01001_001E', 'B01002_001E',
    'B19013_001E',
    'B25003_001E', 'B25003_002E', 'B25010_001E',
    'B15003_001E', 'B15003_017E', 'B15003_022E', 'B15003_023E', 'B15003_024E', 'B15003_025E',
    'B25039_001E',
    'B01001_003E','B01001_004E','B01001_005E','B01001_006E',
    'B01001_007E','B01001_008E','B01001_009E','B01001_010E','B01001_011E','B01001_012E',
    'B01001_013E','B01001_014E','B01001_015E','B01001_016E','B01001_017E','B01001_018E','B01001_019E',
    'B01001_020E','B01001_021E','B01001_022E','B01001_023E','B01001_024E','B01001_025E',
  ];
  const varsBatch2 = [
    'B01001_027E','B01001_028E','B01001_029E','B01001_030E',
    'B01001_031E','B01001_032E','B01001_033E','B01001_034E','B01001_035E','B01001_036E',
    'B01001_037E','B01001_038E','B01001_039E','B01001_040E','B01001_041E','B01001_042E','B01001_043E',
    'B01001_044E','B01001_045E','B01001_046E','B01001_047E','B01001_048E','B01001_049E',
  ];
  const varsBatch3 = [
    'B19001_001E','B19001_002E','B19001_003E','B19001_004E','B19001_005E',
    'B19001_006E','B19001_007E','B19001_008E','B19001_009E','B19001_010E',
    'B19001_011E','B19001_012E','B19001_013E','B19001_014E','B19001_015E',
    'B19001_016E','B19001_017E',
    'B15003_018E','B15003_019E','B15003_020E','B15003_021E',
    'B11001_001E','B11001_002E','B11001_003E','B11001_005E',
    'B11001_006E','B11001_007E','B11001_008E',
    'B08006_001E','B08006_002E','B08006_003E','B08006_008E',
    'B08006_014E','B08006_015E','B08006_016E','B08006_017E',
  ];

  try {
    const [acs1, acs2, acs3] = await Promise.all([
      fetchCensusACS(fips, varsBatch1),
      fetchCensusACS(fips, varsBatch2),
      fetchCensusACS(fips, varsBatch3),
    ]);
    if (!acs1) return null;
    const get = (name) => acs1.get(name) ?? acs2?.get(name) ?? acs3?.get(name);

    const totalPop = safeInt(get('B01001_001E')) || 1;
    const medianAge = parseFloat(get('B01002_001E')) || null;
    const medianIncome = safeInt(get('B19013_001E'));
    const totalHousing = safeInt(get('B25003_001E')) || 1;
    const ownerOcc = safeInt(get('B25003_002E'));
    const avgHHSize = parseFloat(get('B25010_001E')) || null;
    const eduBase = safeInt(get('B15003_001E')) || 1;
    const hsGrad = safeInt(get('B15003_017E'));
    const bachelor = safeInt(get('B15003_022E'));
    const master = safeInt(get('B15003_023E'));
    const profDeg = safeInt(get('B15003_024E'));
    const doctoral = safeInt(get('B15003_025E'));

    const sum = (...names) => names.reduce((acc, n) => acc + safeInt(get(n)), 0);

    const under18 = sum(
      'B01001_003E','B01001_004E','B01001_005E','B01001_006E',
      'B01001_027E','B01001_028E','B01001_029E','B01001_030E',
    );
    const age18to34 = sum(
      'B01001_007E','B01001_008E','B01001_009E','B01001_010E','B01001_011E','B01001_012E',
      'B01001_031E','B01001_032E','B01001_033E','B01001_034E','B01001_035E','B01001_036E',
    );
    const age35to64 = sum(
      'B01001_013E','B01001_014E','B01001_015E','B01001_016E','B01001_017E','B01001_018E','B01001_019E',
      'B01001_037E','B01001_038E','B01001_039E','B01001_040E','B01001_041E','B01001_042E','B01001_043E',
    );
    const age65plus = sum(
      'B01001_020E','B01001_021E','B01001_022E','B01001_023E','B01001_024E','B01001_025E',
      'B01001_044E','B01001_045E','B01001_046E','B01001_047E','B01001_048E','B01001_049E',
    );

    const pct = (n) => Math.round(n / totalPop * 100);
    const under18Pct = pct(under18);
    const age18to34Pct = pct(age18to34);
    const age35to64Pct = pct(age35to64);
    const age65plusPct = pct(age65plus);

    const ageGroups = [
      { pct: under18Pct, label: 'Families with children' },
      { pct: age18to34Pct, label: 'Young professionals' },
      { pct: age35to64Pct, label: 'Established households' },
      { pct: age65plusPct, label: 'Retirees and seniors' },
    ];
    const primaryGroup = ageGroups.reduce((a, b) => a.pct >= b.pct ? a : b).label;

    const ownershipRate = Math.round(ownerOcc / totalHousing * 100);
    const bachelorPct = Math.round(bachelor / eduBase * 100);
    const graduatePct = Math.round((master + profDeg + doctoral) / eduBase * 100);
    const collegePct = bachelorPct + graduatePct;

    // Median tenure: Census gives year householder moved in; subtract from current year
    const medianMoveYear = parseInt(get('B25039_001E'), 10);
    const medianTenureYears = (!isNaN(medianMoveYear) && medianMoveYear > 1970)
      ? new Date().getFullYear() - medianMoveYear
      : null;

    return {
      totalPop,
      medianAge,
      age: { under18: under18Pct, age18to34: age18to34Pct, age35to64: age35to64Pct, age65plus: age65plusPct, primaryGroup },
      income: { median: medianIncome > 0 ? medianIncome : null, level: getIncomeLevel(medianIncome) },
      education: { bachelor: bachelorPct, graduate: graduatePct, collegePct, level: getEducationLevel(collegePct) },
      community: {
        ownershipRate,
        avgHHSize,
        medianTenureYears,
        type: getCommunityType(ownershipRate, avgHHSize),
        densityType: getDensityType(totalPop),
      },
      incomeDistribution:    groupIncomeBrackets(get),
      educationLadder:       buildEducationLadder(get),
      householdComposition:  buildHouseholdComposition(get),
      commuteMode:           buildCommuteMode(get),
      tractFips:             buildTractFips(fips),
    };
  } catch (err) {
    console.error('[Demographics]', err.message);
    return null;
  }
}

const SOURCES = [
  { id: 'census-acs-demographics', label: 'Census ACS5 demographics', provider: 'census', coverage: 'all', requiresKey: 'CENSUS_API_KEY',
    run: (ctx) => getDemographics(ctx.lat, ctx.lng, ctx.fips),
    isValid: (r) => r !== null && typeof r?.totalPop === 'number' && r.totalPop > 0 },
];

module.exports = {
  getDemographics,
  getIncomeLevel,
  getEducationLevel,
  getDensityType,
  getCommunityType,
  suppressed,
  groupIncomeBrackets,
  buildEducationLadder,
  buildHouseholdComposition,
  buildCommuteMode,
  buildTractFips,
  SOURCES,
};
