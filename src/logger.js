const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../data/logs');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function todayFile() {
  return path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.jsonl`);
}

function append(entry) {
  try {
    ensureLogDir();
    fs.appendFileSync(todayFile(), JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // logging must never crash the app
  }
}

function logRequest(address, outcome, durationMs, errorType = null) {
  append({ type: 'request', ts: new Date().toISOString(), address, outcome, durationMs, errorType });
}

function logError(fn, address, error) {
  append({
    type: 'error',
    ts: new Date().toISOString(),
    fn,
    address,
    errorMsg: error?.message || String(error),
  });
}

function readRecentLogs(windowDays = 7) {
  const entries = [];
  try {
    ensureLogDir();
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const file = path.join(LOG_DIR, `${d}.jsonl`);
      if (!fs.existsSync(file)) continue;
      const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try { entries.push(JSON.parse(line)); } catch { /* skip corrupt line */ }
      }
    }
  } catch {
    // return whatever we managed to read
  }
  return entries;
}

function logAnalysis() {
  setImmediate(() => {
    try {
      const { analyzeAndMitigate } = require('./errorMemory');
      analyzeAndMitigate(readRecentLogs(7));
    } catch {
      // analysis failure must never crash the app
    }
  });
}

module.exports = { logRequest, logError, logAnalysis, readRecentLogs };
