'use strict';

// FR-066 — shared OSM Overpass client (extracted from sensory/data.js).
// Individual Overpass mirrors are flaky (429 rate limits, HTML error pages,
// unreachable hosts), so rotate through the configured endpoints until one
// answers. Returns the raw ok Response, or null when the whole pool fails.
// Lives in shared/ so every OSM-backed module reuses one client (CONSTRAINT-014).

const { OVERPASS_ENDPOINTS } = require('../utils/constants');

// Overpass blocks requests with Node's default fetch User-Agent (returns 406),
// and etiquette asks clients to identify themselves. Without this every Overpass
// call silently fails — affecting Sensory's OSM features too, not just FR-066.
const OVERPASS_USER_AGENT = 'Livably/1.0 (residential address intelligence report)';

async function fetchOverpass(query, timeoutMs = 15000) {
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const base = OVERPASS_ENDPOINTS[i];
    try {
      const resp = await fetch(
        `${base}?data=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': OVERPASS_USER_AGENT } },
      );
      if (resp.ok) return resp;
      // 429 = rate limited, 406 = blocked — try next endpoint after a brief pause
      if (resp.status === 429 || resp.status === 406) {
        if (i < OVERPASS_ENDPOINTS.length - 1) await new Promise((r) => setTimeout(r, 300));
      }
    } catch {}
  }
  return null;
}

module.exports = { fetchOverpass };
