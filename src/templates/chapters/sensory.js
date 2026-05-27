'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderChapterCard } = require('../components/chapterCard');

function buildSensoryEnvironmentalHTML(env) {
  if (!env) return '';
  const { airports, roadNoise, rail, lightPollution, airQuality, waterQuality, radon, ejscreen } = env;

  // ── Section A: What You'll Hear ───────────────────────────────────────────

  let airportPara;
  if (!airports || !airports.length) {
    airportPara = 'No airports are within 20 miles of this address. Commercial and general aviation flight traffic is not a daily experience here.';
  } else {
    const n = airports[0];
    const d = n.distanceMiles.toFixed(1);
    if (n.distanceMiles < 5) {
      airportPara = `${escapeHtml(n.name)} is ${d} miles away — close enough that aircraft on approach or departure are frequently audible, particularly in the mornings and evenings. Consider visiting the property during early morning hours (6–9am weekdays) before committing.`;
    } else if (n.distanceMiles < 10) {
      airportPara = `${escapeHtml(n.name)} is approximately ${d} miles away. Aircraft on approach or departure paths may be audible at this distance during peak periods. Worth visiting at different times of day to gauge the actual sound level.`;
    } else if (n.distanceMiles < 15) {
      airportPara = `The nearest airport, ${escapeHtml(n.name)}, is ${d} miles away. Depending on prevailing winds and runway configuration, some approach traffic may occasionally be audible overhead. At this distance, it's not typically disruptive.`;
    } else {
      airportPara = `The nearest airport, ${escapeHtml(n.name)}, is ${d} miles away. At that distance, aircraft are at altitude and not meaningfully audible at ground level. Flight noise is not a daily factor here.`;
    }
    if (airports.length > 1) {
      const others = airports.slice(1, 3).map((a) => `${escapeHtml(a.name)} (${a.distanceMiles.toFixed(1)} mi)`).join(' and ');
      airportPara += ` ${others} ${airports.length === 2 ? 'is' : 'are'} also in the region.`;
    }
  }

  let roadNoisePara;
  if (!roadNoise) {
    roadNoisePara = 'Road noise data was not available for this address.';
  } else {
    const { dnl, source, nearestRoad } = roadNoise;
    const srcNote = source === 'BTS' ? ' (BTS National Transportation Noise Map)' : ' (estimated from highway proximity)';
    const roadRef = nearestRoad?.name ? ` Nearest major road: ${escapeHtml(nearestRoad.name)}.` : '';
    if (dnl < 55) {
      roadNoisePara = `Road noise is low — approximately ${dnl} dB day-night average${srcNote}. That's well below the FHWA's 65 dB residential threshold, and in a range most people describe as quiet.${roadRef}`;
    } else if (dnl < 65) {
      roadNoisePara = `Road noise is moderate — approximately ${dnl} dB day-night average${srcNote}. Highway sound may be noticeable with windows open during busy periods. This is within FHWA's acceptable residential range, but worth evaluating at different times of day.${roadRef}`;
    } else {
      roadNoisePara = `Road noise is elevated at approximately ${dnl} dB day-night average${srcNote} — above FHWA's 65 dB residential standard. Outdoor spaces and open windows will carry highway sound. Evaluate this on-site, not just on paper.${roadRef}`;
    }
  }

  let railPara;
  if (!rail) {
    railPara = 'No freight or passenger rail lines run within 3 miles of this address. Train noise is not a factor here.';
  } else {
    const typeLabel = rail.type === 'light_rail' ? 'light rail' : rail.type === 'tram' ? 'tram' : 'rail';
    const nameStr = rail.name ? `${escapeHtml(rail.name)} ` : '';
    if (rail.distanceMiles < 0.25) {
      railPara = `A ${nameStr}${typeLabel} line runs less than a quarter mile from this address. At that proximity, trains will be audible indoors. Freight schedules aren't fixed — trains can pass at any hour, including overnight.`;
    } else if (rail.distanceMiles < 0.75) {
      railPara = `A ${nameStr}${typeLabel} line runs approximately ${Math.round(rail.distanceMiles * 5280)} feet away. Whether trains are audible inside depends on frequency and construction. Listen for this during any site visit.`;
    } else {
      railPara = `The nearest ${typeLabel} line (${nameStr.trim() || 'unnamed'}) is ${rail.distanceMiles.toFixed(2)} miles away. At that distance, trains are unlikely to be audible indoors except possibly on quiet nights with windows open.`;
    }
  }

  const sectionA = `
    <div class="prem-sensory-section">
      <div class="prem-sensory-label">What You'll Hear</div>
      <div class="prem-narrative">
        <p class="prem-narrative-lead">${airportPara}</p>
        <p class="prem-narrative-body">${roadNoisePara}</p>
        <p class="prem-narrative-body">${railPara}</p>
      </div>
    </div>`;

  // ── Section B: What You'll See at Night ──────────────────────────────────

  let lightPara;
  if (!lightPollution) {
    lightPara = 'Night sky brightness data was not available for this address.';
  } else {
    const { bortle, label, desc } = lightPollution;
    lightPara = `The night sky here is roughly Bortle ${bortle} — a ${escapeHtml(label)}. ${escapeHtml(desc)} This is estimated from Census tract population density and nearby land use patterns, not satellite measurement.`;
  }

  const sectionB = `
    <div class="prem-sensory-section">
      <div class="prem-sensory-label">What You'll See at Night</div>
      <div class="prem-narrative">
        <p class="prem-narrative-lead">${lightPara}</p>
      </div>
    </div>`;

  // ── Section C: What You Can't See ────────────────────────────────────────

  let airPara;
  if (airQuality) {
    const { aqi, category: c, primaryPollutant } = airQuality;
    const pollNote = primaryPollutant && primaryPollutant !== 'N/A' ? ` Primary pollutant: ${escapeHtml(primaryPollutant)}.` : '';
    airPara = `Air quality in this region averages AQI ${aqi} — ${escapeHtml(c.label.toLowerCase())}. ${escapeHtml(c.description)}${pollNote} Source: EPA AirNow, nearest monitoring station.`;
  } else {
    airPara = 'Air quality data was not available for this address. Check EPA AirNow (airnow.gov) for current conditions in your area.';
  }

  let waterPara;
  if (!waterQuality) {
    waterPara = 'EPA drinking water records were not accessible for this address. Check historical water quality at <a href="https://www.ewg.org/tapwater/" target="_blank" rel="noopener">EWG\'s Tap Water Database</a> (search by zip code) and request your utility\'s Consumer Confidence Report before closing.';
  } else if (!waterQuality.violations?.length) {
    waterPara = `Water here is supplied by ${escapeHtml(waterQuality.systemName)}. EPA Safe Drinking Water records show no health-based violations in the last five years — a clean record. You can request the annual Consumer Confidence Report from the utility for full detail.`;
  } else {
    const v = waterQuality.violations[0];
    const dateStr = v.date ? ` in ${v.date.slice(0, 4)}` : '';
    const statusStr = (v.status && v.status !== 'Unknown') ? ` — ${escapeHtml(v.status)}` : '';
    waterPara = `Water here is supplied by ${escapeHtml(waterQuality.systemName)}. EPA records show ${waterQuality.violations.length} violation${waterQuality.violations.length > 1 ? 's' : ''} in the last five years. The most recent: ${escapeHtml(v.type)}${dateStr}${statusStr}. Request the utility's Consumer Confidence Report before closing to understand current status.`;
  }

  let radonPara;
  if (!radon) {
    radonPara = 'Radon zone data requires county identification. Verify your county\'s EPA radon zone at epa.gov/radon. Testing is inexpensive and recommended before purchase.';
  } else if (radon.zone === 1) {
    radonPara = 'This county is EPA Radon Zone 1 — high geologic potential for elevated indoor radon. Radon is the second-leading cause of lung cancer, and it\'s odorless and invisible. Testing is strongly recommended before closing: DIY kits run $15–$30 and results come back in days. If elevated, mitigation systems typically cost $800–$2,500 installed.';
  } else if (radon.zone === 2) {
    radonPara = 'This county is EPA Radon Zone 2 — moderate geologic potential for radon. Testing is recommended, particularly if the home has below-grade living space. Kits are inexpensive and widely available.';
  } else {
    radonPara = 'This county is EPA Radon Zone 3 — lower geologic potential for elevated radon. While the risk is reduced here, no zone is radon-free. A quick test remains a reasonable precaution, especially for homes with basements.';
  }
  if (radon) radonPara += ' Note: Zone classifications are county-level, not parcel-specific. Source: EPA Radon Zone Map.';

  let ejPara;
  if (!ejscreen) {
    ejPara = 'EPA environmental screening (EJSCREEN) data was not accessible via API. Check environmental hazard proximity at <a href="https://ejscreen.epa.gov/mapper/" target="_blank" rel="noopener">EPA EJSCREEN</a> — search this address to see Superfund site proximity, air toxics, and chemical facility flags for this location.';
  } else if (ejscreen.flagged) {
    const flags = [];
    if (ejscreen.superfundPct > 75) flags.push(`${ejscreen.superfundPct}th percentile nationally for proximity to Superfund sites`);
    if (ejscreen.rmpPct > 75)       flags.push(`${ejscreen.rmpPct}th percentile for chemical risk facilities`);
    if (ejscreen.tsdfPct > 75)      flags.push(`${ejscreen.tsdfPct}th percentile for hazardous waste facilities`);
    ejPara = `EPA EJSCREEN flags this location: ${flags.join('; ')}. That means more nearby industrial or hazardous-site activity than the majority of US residential locations. Review the EPA ECHO database for specific facilities near this address.`;
  } else {
    ejPara = 'EPA environmental screening (EJSCREEN) shows no significant proximity concerns — below the 75th national percentile for Superfund sites, chemical risk facilities, and hazardous waste sites.';
  }

  const sectionC = `
    <div class="prem-sensory-section">
      <div class="prem-sensory-label">What You Can't See</div>
      <div class="prem-narrative">
        <p class="prem-narrative-body">${airPara}</p>
        <p class="prem-narrative-body">${waterPara}</p>
        <p class="prem-narrative-body">${radonPara}</p>
        <p class="prem-narrative-body">${ejPara}</p>
      </div>
    </div>`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────

  let takeaway;
  if (airports?.length && airports[0].distanceMiles < 10) {
    takeaway = `${escapeHtml(airports[0].name)} is ${airports[0].distanceMiles.toFixed(1)} miles away. Visit the property during morning hours (6–9am weekdays) to hear the actual aircraft noise level before committing.`;
  } else if (roadNoise?.dnl >= 65) {
    takeaway = `Road noise at this location (~${roadNoise.dnl} dB) exceeds the FHWA residential standard of 65 dB. Evaluate it on-site during peak traffic hours.`;
  } else if (waterQuality?.violations?.length) {
    const v = waterQuality.violations[0];
    takeaway = `EPA records show a recent water quality violation (${escapeHtml(v.type)}). Request the utility's Consumer Confidence Report before closing.`;
  } else if (radon?.zone === 1) {
    takeaway = 'This is a high-radon county (EPA Zone 1). Include radon testing in your inspection scope — a $20 kit prevents a costly and dangerous surprise.';
  } else if (ejscreen?.flagged) {
    takeaway = 'EPA environmental screening flagged elevated industrial hazard proximity for this location. Review EPA ECHO for specific nearby facilities.';
  } else if (rail && rail.distanceMiles < 0.5) {
    takeaway = `A rail line runs ${Math.round(rail.distanceMiles * 5280)} feet from this address. Visit during evening or overnight hours to evaluate train noise.`;
  } else {
    const aqLabel = airQuality ? escapeHtml(airQuality.category.label.toLowerCase()) : 'not reported';
    takeaway = `No major noise, water, or hazard concerns were identified for this location. Air quality is ${aqLabel} per EPA monitoring.`;
  }

  const sources = [
    airports   && 'Google Places (airports)',
    roadNoise  && 'BTS National Transportation Noise Map / OpenStreetMap (road noise)',
    rail       && 'OpenStreetMap (rail)',
    lightPollution && 'U.S. Census ACS / OpenStreetMap (light pollution, estimated)',
    airQuality && 'EPA AirNow (air quality)',
    waterQuality && 'EPA ECHO/SDWIS (water quality)',
    radon      && 'EPA Radon Zone Map (county-level)',
    ejscreen   && 'EPA EJSCREEN (hazard proximity)',
  ].filter(Boolean).join('; ');

  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const leftHTML =
    sectionA + sectionC +
    `<div class="key-takeaway">
      <span class="kt-icon">🔑</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${takeaway}</div>
    </div>` +
    `<p class="prem-disclaimer">Sources: ${sources}. Research date: ${today}. Light pollution is estimated, not satellite-measured.</p>`;

  // Bortle scale full-width visual
  const bortleNum = lightPollution?.bortle ?? 5;
  const bortlePct = ((bortleNum - 1) / 8) * 100;
  const bortleFullHTML = `
    <div class="prem-bortle-scale">
      <div class="prem-bortle-track" role="img" aria-label="Bortle scale: ${bortleNum} of 9">
        <div class="prem-bortle-marker" style="left:${bortlePct}%"></div>
      </div>
      <div class="prem-bortle-labels">
        <span>1 — Darkest skies</span>
        <span>9 — City center</span>
      </div>
      <p class="prem-bortle-desc">${lightPollution ? `Bortle ${bortleNum} — <strong>${escapeHtml(lightPollution.label)}</strong>: ${escapeHtml(lightPollution.desc)}` : 'Night sky brightness could not be estimated for this address.'}</p>
    </div>`;

  const eyeSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  return renderChapterCard('sensory', '12', eyeSvg, 'Sensory &amp; Environmental', 'What you can\'t discover during a showing.', null, leftHTML, sectionB, bortleFullHTML, null);
}

module.exports = { buildSensoryEnvironmentalHTML };
