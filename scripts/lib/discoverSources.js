'use strict';
const fs = require('fs');
const path = require('path');

// Globs src/modules/<name>/data.js, requires each, flattens its SOURCES array
// (tagging each entry with its module). Modules without SOURCES are warned, not fatal.
function discoverSources(modulesDir, logger = console) {
  const out = [];
  for (const dirent of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const name = dirent.name;
    const dataPath = path.join(modulesDir, name, 'data.js');
    if (!fs.existsSync(dataPath)) continue;
    const mod = require(dataPath);
    if (!Array.isArray(mod.SOURCES)) {
      logger.warn(`[verify] ${name}/data.js exports no SOURCES — skipped`);
      continue;
    }
    for (const s of mod.SOURCES) out.push({ module: name, ...s });
  }
  return out;
}

module.exports = { discoverSources };
