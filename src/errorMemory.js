const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PATTERNS_FILE = path.join(DATA_DIR, 'error-patterns.json');
const MITIGATIONS_FILE = path.join(DATA_DIR, 'mitigations.json');

// Only grocery has a radius that can be safely auto-expanded.
// Others (pharmacy, urgent care) use rankby:distance which ignores radius.
// Highway is excluded per BUG-003 — never auto-change highway search params.
const MITIGATION_RULES = [
  { fn: 'findNearestGrocery', key: 'searchRadiusM', threshold: 0.15, defaultValue: 8000, expandedValue: 12000 },
  { fn: 'findNearestHospital',    threshold: 0.15, flagOnly: true },
  { fn: 'findNearestPharmacy',    threshold: 0.15, flagOnly: true },
  { fn: 'findNearestUrgentCare',  threshold: 0.15, flagOnly: true },
  { fn: 'findNearestHighwayOnRamp', threshold: 0.20, flagOnly: true },
  { fn: 'getPremiumData',         threshold: 0.20, flagOnly: true },
  { fn: 'report',                 threshold: 0.20, flagOnly: true },
];

function loadMitigations() {
  try { return JSON.parse(fs.readFileSync(MITIGATIONS_FILE, 'utf8')); } catch { return {}; }
}

function saveMitigations(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MITIGATIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch { /* best-effort */ }
}

function getMitigation(fn, key, defaultValue) {
  try {
    const m = loadMitigations();
    return m[fn]?.[key] ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

function analyzeAndMitigate(entries) {
  const requests = entries.filter((e) => e.type === 'request');
  const errors   = entries.filter((e) => e.type === 'error');
  const totalRequests = requests.length;

  const fnFailures = {};
  for (const e of errors) {
    if (!e.fn) continue;
    if (!fnFailures[e.fn]) fnFailures[e.fn] = { count: 0, messages: [] };
    fnFailures[e.fn].count++;
    if (!fnFailures[e.fn].messages.includes(e.errorMsg)) {
      fnFailures[e.fn].messages.push(e.errorMsg);
    }
  }

  const functions = {};
  for (const [fn, data] of Object.entries(fnFailures)) {
    const failureRate = totalRequests > 0 ? data.count / totalRequests : 0;
    const rule = MITIGATION_RULES.find((r) => r.fn === fn);
    const threshold = rule?.threshold ?? 0.15;
    const flagged = failureRate > threshold;
    functions[fn] = {
      failures: data.count,
      failureRate: parseFloat(failureRate.toFixed(4)),
      topErrors: data.messages.slice(0, 3),
      flagged,
      flagReason: flagged
        ? `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds ${(threshold * 100).toFixed(0)}% threshold`
        : null,
    };
  }

  const successCount = requests.filter((r) => r.outcome === 'success').length;
  const patterns = {
    analyzedAt: new Date().toISOString(),
    windowDays: 7,
    functions,
    requestStats: {
      total: totalRequests,
      success: successCount,
      error: requests.filter((r) => r.outcome === 'error').length,
      successRate: totalRequests > 0 ? parseFloat((successCount / totalRequests).toFixed(4)) : null,
    },
  };

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2), 'utf8');
  } catch { /* best-effort */ }

  // Apply mitigations for rules that support auto-apply (non-flagOnly)
  const mitigations = loadMitigations();
  let changed = false;

  for (const rule of MITIGATION_RULES) {
    if (rule.flagOnly || !rule.key) continue;
    const fnData = functions[rule.fn];
    if (!fnData?.flagged) continue;
    // Idempotent — only apply once; don't keep overwriting
    if (mitigations[rule.fn]?.[rule.key] && mitigations[rule.fn][rule.key] !== rule.defaultValue) continue;

    if (!mitigations[rule.fn]) mitigations[rule.fn] = {};
    mitigations[rule.fn][rule.key] = rule.expandedValue;
    mitigations[rule.fn].reason = `Auto-expanded from ${rule.defaultValue}m — failure rate was ${(fnData.failureRate * 100).toFixed(1)}% over 7 days`;
    mitigations[rule.fn].appliedAt = new Date().toISOString();
    changed = true;
  }

  if (changed) {
    mitigations.updatedAt = new Date().toISOString();
    saveMitigations(mitigations);
  }
}

module.exports = { getMitigation, analyzeAndMitigate, loadMitigations };
