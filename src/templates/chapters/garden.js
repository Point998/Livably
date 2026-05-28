'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderChapterCard } = require('../components/chapterCard');
const { STATE_EXTENSION } = require('../../utils/constants');

function buildWhatWillGrowHTML(gardenData, soil, locationInfo) {
  if (!gardenData) return '';

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const county = locationInfo?.county || '';
  const state = locationInfo?.state || '';
  const ext = STATE_EXTENSION[state] || null;
  const { hardinessZone, nativePlants, invasivePlants, wildlife, birds } = gardenData;

  // ── Growing Conditions ──
  let conditionsPara = '';
  if (hardinessZone) {
    const { zone, tempRange, frost } = hardinessZone;
    const zoneNote = tempRange ? ` (average winter low: ${tempRange}°F)` : '';
    conditionsPara = `This property sits in USDA Hardiness Zone ${escapeHtml(zone)}${zoneNote}. `;
    if (frost) {
      conditionsPara += `The last spring frost typically falls around <strong>${escapeHtml(frost.lastSpring)}</strong> and the first fall frost arrives around <strong>${escapeHtml(frost.firstFall)}</strong> — giving you a growing season of roughly ${frost.days} days. `;
      if (frost.days >= 180) {
        conditionsPara += `That's enough time for tomatoes, peppers, squash, and most vegetables to complete a full cycle.`;
      } else if (frost.days >= 120) {
        conditionsPara += `That's enough time for fast-maturing vegetables and most annuals, though warm-season crops need a head start indoors.`;
      } else {
        conditionsPara += `It's a shorter season — focus on cold-hardy crops and varieties bred for quick maturity.`;
      }
    }
  } else {
    conditionsPara = `Hardiness zone data was not available for this address. You can look up your zone at the USDA Plant Hardiness Zone Map at planthardiness.ars.usda.gov.`;
  }

  // ── Soil ──
  let soilPara = '';
  if (soil) {
    const name = soil.muname || 'this soil type';
    const drain = soil.drainageCategory;
    const isUrban = !soil.drainagecl && name.toLowerCase().includes('urban');
    if (isUrban) {
      soilPara = `This address is on developed urban land — standard soil survey data isn't available for this parcel. For drainage and foundation soil information, request a geotechnical report or ask the seller about any known drainage issues.`;
    } else {
      soilPara = `The lot sits on ${escapeHtml(name)}${soil.drainagecl ? ` — USDA drainage class: ${escapeHtml(soil.drainagecl.toLowerCase())}` : ''}. `;
      if (drain && drain.color !== 'muted') {
        soilPara += escapeHtml(drain.implication) + ' ';
      }
      if (drain?.color === 'green' || drain?.color === 'lightgreen') {
        soilPara += `A layer of compost before planting and you're in good shape.`;
      } else if (drain?.color === 'orange' || drain?.color === 'red') {
        soilPara += `Raised beds are a practical solution for vegetable gardens — they let you control drainage regardless of the native soil conditions.`;
      }
    }
  }

  // ── Native Plants ──
  let nativePlantsHTML = '';
  if (nativePlants.length > 0) {
    const items = nativePlants.map((p) =>
      `<li class="grow-plant-item"><span class="grow-plant-name">${escapeHtml(p.name)}</span> <em class="grow-plant-sci">(${escapeHtml(p.sci)})</em></li>`
    ).join('\n');
    nativePlantsHTML = `
    <div class="grow-subsection">
      <div class="grow-subsection-label">🌿 What Grows Naturally Here</div>
      <p class="prem-narrative-body">These native plants thrive in this region without much help — they've been doing it for centuries. They're adapted to your soil, your rainfall, and your winters, which means less maintenance and more resilience once established.</p>
      <ul class="grow-plant-list">${items}
      </ul>
    </div>`;
  }

  // ── Invasive Plants ──
  let invasivePlantsHTML = '';
  if (invasivePlants.length > 0) {
    const items = invasivePlants.map((p) =>
      `<li class="grow-plant-item"><span class="grow-plant-name">${escapeHtml(p.name)}</span> <em class="grow-plant-sci">(${escapeHtml(p.sci)})</em></li>`
    ).join('\n');
    invasivePlantsHTML = `
    <div class="grow-subsection">
      <div class="grow-subsection-label">⚠️ What to Avoid</div>
      <p class="prem-narrative-body">These introduced plants are frequently observed in this area and cause real problems — they outcompete native plants, can damage trees and structures, or spread aggressively once established. Worth knowing before you plant anything from a nursery.</p>
      <ul class="grow-plant-list">${items}
      </ul>
    </div>`;
  }

  // ── Wildlife ──
  let wildlifeHTML = '';
  if (wildlife.length > 0 || birds.length > 0) {
    let wildlifePara = '';
    if (wildlife.length > 0) {
      const mammalNames = wildlife.slice(0, 4).map((w) => escapeHtml(w.name)).join(', ');
      wildlifePara += `Common mammals observed in this area include ${mammalNames}. `;
      if (wildlife.some((w) => w.name.toLowerCase().includes('deer'))) {
        wildlifePara += `If deer are active nearby, plan any vegetable garden or ornamental plantings with deer-resistant species or fencing. `;
      }
    }
    if (birds.length > 0) {
      const birdNames = birds.slice(0, 5).map((b) => escapeHtml(b.name)).join(', ');
      wildlifePara += `Common backyard birds in this area include ${birdNames}. A simple feeder and a water source will bring them close.`;
    }
    wildlifeHTML = `
    <div class="grow-subsection">
      <div class="grow-subsection-label">🦌 Wildlife You'll Share the Yard With</div>
      <p class="prem-narrative-body">${wildlifePara}</p>
    </div>`;
  }

  // ── Extension Office CTA ──
  let extCTA = '';
  if (ext) {
    const countyLabel = county ? `${escapeHtml(county)}` : escapeHtml(state);
    extCTA = `<p class="grow-ext-cta">Your local Cooperative Extension office offers free soil testing and planting guides specific to your county. For ${countyLabel}: <strong>${escapeHtml(ext.name)}</strong> — <a href="https://${ext.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(ext.url)}</a></p>`;
  } else {
    extCTA = `<p class="grow-ext-cta">Your local Cooperative Extension office offers free soil testing and planting guides specific to your county — search for your state's land-grant university extension service for county-specific resources.</p>`;
  }

  // ── Opportunity paragraph ──
  let opportunityPara = '';
  if (hardinessZone && hardinessZone.frost) {
    const { days } = hardinessZone.frost;
    if (days >= 200) {
      opportunityPara = `A well-maintained yard in this zone with native plantings can become genuinely beautiful with relatively little effort. The growing season is long, rainfall is typically reliable in this region, and native plants require almost no intervention once established.`;
    } else if (days >= 130) {
      opportunityPara = `A well-chosen native garden in this zone rewards low-maintenance effort — the plants are built for these winters and summers, and they'll return every year without replanting. The growing season gives you time for most of what you'd want to grow.`;
    } else {
      opportunityPara = `This is a shorter growing season, but the region's native plants are perfectly matched to it. Focus on cold-hardy perennials and native shrubs — they'll come back each year and don't need babying.`;
    }
  }

  const sources = [
    hardinessZone ? 'USDA Plant Hardiness Zone Map (phzmapi.org)' : null,
    nativePlants.length > 0 ? 'iNaturalist research-grade observations' : null,
    soil ? 'USDA Web Soil Survey' : null,
  ].filter(Boolean).join('; ');

  const gardenBody = `
    <p class="prem-narrative-lead">${conditionsPara}</p>
    ${soilPara ? `
    <div class="grow-subsection">
      <div class="grow-subsection-label">🪱 Your Soil</div>
      <p class="prem-narrative-body">${soilPara}</p>
    </div>` : ''}
    ${nativePlantsHTML}
    ${invasivePlantsHTML}
    ${wildlifeHTML}
    ${opportunityPara ? `
    <div class="grow-subsection">
      <div class="grow-subsection-label">✨ The Opportunity</div>
      <p class="prem-narrative-body">${opportunityPara}</p>
      ${extCTA}
    </div>` : extCTA}
    <div class="key-takeaway">
      <span class="kt-icon">🔑</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${hardinessZone ? `Zone ${escapeHtml(hardinessZone.zone)} gives you ${hardinessZone.frost ? `a ${hardinessZone.frost.days}-day growing season` : 'a defined growing season'}. Native plants adapted to this region require the least effort and give back the most.` : 'Native plants adapted to your region require the least effort and give back the most.'}</div>
    </div>
    <p class="prem-disclaimer">Hardiness zone: USDA phzmapi.org, ZIP-code level. Frost dates are 30-year climate normals correlated with USDA hardiness zone. ${sources ? `Sources: ${escapeHtml(sources)}. ` : ''}Wildlife observations: iNaturalist research-grade, 10-mile radius. Research date: ${today}.</p>`;

  // Frost timeline full-width visual
  let frostFullHTML = null;
  if (hardinessZone?.frost) {
    const frost = hardinessZone.frost;
    const MONTH_DOY = { January: 15, February: 46, March: 75, April: 106, May: 136, June: 167, July: 197, August: 228, September: 259, October: 289, November: 320, December: 350 };
    const parseFrostDate = (str) => {
      const parts = (str || '').split(' ');
      const doy = MONTH_DOY[parts[0]] ?? 180;
      return Math.round((doy / 365) * 100);
    };
    const startPct = parseFrostDate(frost.lastSpring);
    const endPct   = parseFrostDate(frost.firstFall);
    const fillWidth = Math.max(0, endPct - startPct);
    frostFullHTML = `
      <div class="grow-frost-timeline">
        <div class="grow-frost-inner">
          <div class="grow-frost-days">${frost.days}<span class="grow-frost-days-unit"> days</span></div>
          <div class="grow-frost-track" role="img" aria-label="Growing season: ${frost.days} days from ${escapeHtml(frost.lastSpring)} to ${escapeHtml(frost.firstFall)}">
            <div class="grow-frost-fill" style="--start-pct:${startPct}" data-final-width="${fillWidth}%"></div>
          </div>
          <div class="grow-frost-labels">
            <span class="grow-frost-label">${escapeHtml(frost.lastSpring)}</span>
            <span class="grow-frost-label">${escapeHtml(frost.firstFall)}</span>
          </div>
        </div>
      </div>`;
  }

  const leafSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
  return renderChapterCard('garden', '10', leafSvg, 'What Will Grow Here', 'Your yard\'s potential — soil, season, and native species.', null, gardenBody, null, frostFullHTML, null);
}

module.exports = { buildWhatWillGrowHTML };
