'use strict';

function getDrainageCategory(drainagecl) {
  if (!drainagecl) return null;
  const d = drainagecl.toLowerCase();
  if (d.includes('excessively'))      return { label: 'Excessively drained',      color: 'gold',       implication: 'Soil dries out quickly — low basement moisture risk, but may need irrigation for landscaping.' };
  if (d.includes('moderately well'))  return { label: 'Moderately well drained',  color: 'lightgreen', implication: 'Drains well in most conditions; may be briefly wet after heavy rain.' };
  if (d.includes('well drained') || d === 'well drained') return { label: 'Well drained', color: 'green', implication: 'Water drains readily. Low risk of basement moisture from soil conditions.' };
  if (d.includes('somewhat poorly'))  return { label: 'Somewhat poorly drained',  color: 'orange',     implication: 'Stays wet for significant periods — may affect basement moisture and landscaping choices.' };
  if (d.includes('very poorly'))      return { label: 'Very poorly drained',      color: 'red',        implication: 'Water stands near the surface most of the year. Significant moisture risk and likely wetland indicators.' };
  if (d.includes('poorly'))           return { label: 'Poorly drained',           color: 'red',        implication: 'Wet soil most of the year. High basement moisture risk — thorough foundation inspection essential.' };
  return { label: drainagecl, color: 'muted', implication: 'Consult a soil engineer for specific drainage implications at this location.' };
}

function getConstructionEraContext(year) {
  if (!year || isNaN(year)) return null;
  if (year >= 2010) return { era: 'Modern construction (2010s–present)', cautions: [] };
  if (year >= 2000) return { era: '2000s construction', cautions: [] };
  if (year >= 1980) return { era: '1980s–90s construction', cautions: ['Some homes from this era may contain polybutylene plumbing (recalled for failure risk)', 'Asbestos possible in textured surfaces or floor tiles if not previously remediated'] };
  if (year >= 1978) return { era: 'Late 1970s construction', cautions: ['Pre-1980 construction may lack modern insulation standards', 'Aluminum wiring was common in this era — electrical inspection recommended'] };
  if (year >= 1960) return { era: '1960s–70s construction', cautions: ['Pre-1978: lead paint likely in original finishes', 'Asbestos common in floor tiles, insulation, or textured ceilings', 'Galvanized plumbing may be near end of service life'] };
  if (year >= 1940) return { era: '1940s–50s construction', cautions: ['Lead paint presumed in original surfaces', 'Original plumbing (galvanized or cast iron) may be aging', 'Knob-and-tube wiring possible if not updated', 'Asbestos in insulation and building materials is common'] };
  return { era: 'Pre-1940 construction', cautions: ['Lead paint presumed in original surfaces', 'Plumbing and electrical may be original or patchwork-updated — verify', 'Asbestos common in original building materials', 'Structural updates vary widely — confirm with inspection'] };
}

function buildHousingAgeBands(get) {
  const safeCount = (v) => {
    const n = parseInt(v, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  };

  const total = safeCount(get('B25034_001E'));
  if (!total) return null;

  const rawBands = [
    { label: '2010+',    count: safeCount(get('B25034_002E')) + safeCount(get('B25034_003E')) },
    { label: '2000s',    count: safeCount(get('B25034_004E')) },
    { label: '1990s',    count: safeCount(get('B25034_005E')) },
    { label: '1980s',    count: safeCount(get('B25034_006E')) },
    { label: '1970s',    count: safeCount(get('B25034_007E')) },
    { label: '1960s',    count: safeCount(get('B25034_008E')) },
    { label: 'Pre-1960', count: safeCount(get('B25034_009E')) + safeCount(get('B25034_010E')) + safeCount(get('B25034_011E')) },
  ];

  const bands = rawBands.map(b => ({
    ...b,
    pct: Math.round(b.count / total * 100),
  }));

  return { totalUnits: total, bands };
}

module.exports = { getDrainageCategory, getConstructionEraContext, buildHousingAgeBands };
