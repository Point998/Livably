'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderChapterCard } = require('../../templates/components/chapterCard');
const { STATE_EXTENSION } = require('../../utils/constants');

function buildGardenGlanceHTML(gardenData) {
  if (!gardenData) return '';
  const zone = gardenData.hardinessZone?.zone;
  const days = gardenData.hardinessZone?.frost?.days;
  const nativeCount = gardenData.nativePlants?.length || 0;

  const items = [
    zone ? `<span class="chapter-glance-item">Zone ${escapeHtml(zone)}</span>` : '',
    days != null ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">${days}-day growing season</span>` : '',
    nativeCount > 0 ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">${nativeCount} native species documented nearby</span>` : '',
  ].filter(Boolean).join('');

  return items ? `<div class="chapter-glance">${items}</div>` : '';
}

function buildMicroclimateHTML(microclimate) {
  if (!microclimate) return '';
  const { lat, elevationFt, solarSummerDeg, solarWinterDeg } = microclimate;

  const elevNote = elevationFt !== null
    ? `This address sits at approximately ${Math.round(elevationFt / 10) * 10} feet in elevation. `
    : '';

  const shadowFt = Math.round(6 / Math.tan(solarWinterDeg * Math.PI / 180));
  const latRound = Math.round(lat);

  const sunNote = `At latitude ${latRound}°, the noon sun reaches about ${solarSummerDeg}° above the horizon in late June — near-overhead, flooding the yard with light. By late December that drops to ${solarWinterDeg}°, meaning a 6-foot fence or hedge on the south side of a garden casts about a ${shadowFt}-foot shadow at midday.`;

  const practical = `South-facing beds and cold frames capture the most winter light — orient them toward the south for the best yield in early spring and late fall.`;

  return `
    <div class="grow-subsection">
      <div class="grow-subsection-label">☀️ Your Microclimate</div>
      <p class="prem-narrative-body">${elevNote}${sunNote} ${practical}</p>
    </div>`;
}

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
    ${buildMicroclimateHTML(gardenData?.microclimate)}
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

  const deepDiveContent = buildGardenDeepDiveHTML(gardenData, locationInfo);
  const combinedFullHTML = [frostFullHTML, deepDiveContent ? `<div class="depth-l3">${deepDiveContent}</div>` : null].filter(Boolean).join('');
  const glanceHTML = buildGardenGlanceHTML(gardenData);

  const leafSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
  return renderChapterCard('garden', '10', leafSvg, 'What Will Grow Here', 'Your yard\'s potential — soil, season, and native species.', null, gardenBody, null, combinedFullHTML || null, null, glanceHTML || null);
}

// ── FR-042: Level 3 — Garden Deep Dive ───────────────────────────────────────

function buildGardenDeepDiveHTML(gardenData, locationInfo) {
  if (!gardenData) return '';
  const { hardinessZone, nativePlantsByForm, invasivePlants, reptiles,
          butterflies, birdsBySeason, monarchCorridor, fireflyHabitat } = gardenData;
  const tabs = [
    { id: 'trees',       label: 'Trees',            content: buildTreesTab(nativePlantsByForm, hardinessZone)                                   },
    { id: 'shrubs',      label: 'Shrubs & Flowers', content: buildShrubsTab(nativePlantsByForm, hardinessZone)                                   },
    { id: 'food',        label: 'Food Garden',      content: buildFoodGardenTab(hardinessZone, null)                                             },
    { id: 'birds',       label: 'Birds',            content: buildBirdsTab(birdsBySeason, gardenData.birds)                                      },
    { id: 'pollinators', label: 'Pollinators',      content: buildPollinatorsTab(butterflies, monarchCorridor, fireflyHabitat)                    },
    { id: 'wildlife',    label: 'Wildlife',         content: buildWildlifeTab(gardenData.wildlife, reptiles)                                    },
    { id: 'calendar',   label: 'Month by Month',   content: buildSeasonalCalendarTab(hardinessZone, birdsBySeason, monarchCorridor)              },
    { id: 'remove',      label: 'What to Remove',  content: buildInvasivesTab(invasivePlants)                                                    },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="garden-tab${i === 0 ? ' garden-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="gtab-${t.id}" id="gbtn-${t.id}">${escapeHtml(t.label)}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="garden-tab-panel${i === 0 ? ' garden-tab-panel--active' : ''}" id="gtab-${t.id}" role="tabpanel" aria-labelledby="gbtn-${t.id}"${i === 0 ? '' : ' hidden'}>${t.content}</div>`
  ).join('');

  return `
    <div class="garden-deep-dive">
      <nav class="garden-tab-nav" role="tablist" aria-label="Garden deep dive">
        ${tabButtons}
      </nav>
      <div class="garden-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}

function buildTreesTab(byForm, hardinessZone) {
  const zone = hardinessZone?.zone || '';
  const trees = (byForm?.trees || []).slice(0, 8);
  const shrubsAsUnderstory = (byForm?.shrubs || []).slice(0, 4);

  const intro = `<p class="prem-narrative-body">These are the tree species your iNaturalist neighbors are actually observing within 10 miles — native, adapted to Zone ${escapeHtml(zone) || 'your hardiness zone'}, and worth considering for your yard.</p>`;

  if (!trees.length && !shrubsAsUnderstory.length) {
    return `${intro}<p class="prem-narrative-body">Native tree observation data is limited for this area. Contact your local Cooperative Extension office for county-specific native tree recommendations.</p>`;
  }

  const makeItems = (arr) => arr.map((t) =>
    `<div class="garden-species-item"><span class="garden-species-name">${escapeHtml(t.name)}</span> <em class="garden-species-sci">(${escapeHtml(t.sci)})</em></div>`
  ).join('');

  return `
    ${intro}
    ${trees.length ? `<div class="garden-species-group"><div class="garden-species-group-label">Canopy &amp; Shade Trees</div>${makeItems(trees)}</div>` : ''}
    ${shrubsAsUnderstory.length ? `<div class="garden-species-group"><div class="garden-species-group-label">Understory Trees &amp; Large Shrubs</div>${makeItems(shrubsAsUnderstory)}</div>` : ''}
    <p class="prem-narrative-body">Plant trees in fall when roots establish before spring growth. Stake only if needed the first year — trees develop stronger trunks when they can sway.</p>
    <p class="prem-disclaimer">Species based on iNaturalist research-grade observations within 10 miles.</p>`;
}

function buildShrubsTab(byForm, hardinessZone) {
  const shrubs     = (byForm?.shrubs     || []).slice(0, 8);
  const perennials = (byForm?.perennials || []).slice(0, 8);
  const grasses    = (byForm?.grasses    || []).slice(0, 4);

  const makeItems = (arr) => arr.map((p) =>
    `<div class="garden-species-item"><span class="garden-species-name">${escapeHtml(p.name)}</span> <em class="garden-species-sci">(${escapeHtml(p.sci)})</em></div>`
  ).join('');

  return `
    <p class="prem-narrative-body">Native shrubs and perennials create a layered yard that supports more wildlife than lawn. They bloom sequentially through the season, attract pollinators, and require almost no care once established.</p>
    ${shrubs.length     ? `<div class="garden-species-group"><div class="garden-species-group-label">Native Shrubs</div>${makeItems(shrubs)}</div>`                             : ''}
    ${perennials.length ? `<div class="garden-species-group"><div class="garden-species-group-label">Native Perennials &amp; Wildflowers</div>${makeItems(perennials)}</div>` : ''}
    ${grasses.length    ? `<div class="garden-species-group"><div class="garden-species-group-label">Native Grasses &amp; Sedges</div>${makeItems(grasses)}</div>`            : ''}
    ${!shrubs.length && !perennials.length ? '<p class="prem-narrative-body">Contact your local Cooperative Extension office for county-specific native shrub and perennial recommendations.</p>' : ''}
    <p class="prem-disclaimer">Species based on iNaturalist research-grade observations within 10 miles.</p>`;
}

function buildFoodGardenTab(hardinessZone, soil) {
  const zone       = hardinessZone?.zone || '';
  const frost      = hardinessZone?.frost;
  const lastSpring = frost?.lastSpring || 'mid-April';
  const firstFall  = frost?.firstFall  || 'mid-October';
  const days       = frost?.days       || 180;

  const warmCutoff = days >= 180 ? 'May 1'   : days >= 140 ? 'May 10'    : 'May 15';
  const fallStart  = days >= 180 ? 'August 15' : days >= 140 ? 'August 1' : 'July 20';

  const soilNote = !soil ? '' :
    soil?.drainageCategory?.color === 'orange' || soil?.drainageCategory?.color === 'red'
      ? '<p class="prem-narrative-body">This soil drains slowly — raised beds are practical for vegetable gardens. They let you control drainage and soil quality regardless of native conditions.</p>'
      : soil?.drainageCategory?.color === 'green' || soil?.drainageCategory?.color === 'lightgreen'
        ? '<p class="prem-narrative-body">Well-drained soil is a genuine advantage for vegetable gardening. Amend with compost before planting and you have a strong foundation.</p>'
        : '';

  return `
    <p class="prem-narrative-body">Zone ${escapeHtml(zone)} gives you a ${days}-day growing season — enough for two cool-season windows and a full warm-season run in between.</p>
    <div class="garden-species-group">
      <div class="garden-species-group-label">Cool Season (plant before ${escapeHtml(lastSpring)} and ${escapeHtml(fallStart)}–Sept 15)</div>
      <p class="prem-narrative-body">Kale, spinach, lettuce, arugula, peas, radish, broccoli, cabbage — these thrive in cool weather and can handle light frost. Spring crops go in 4–6 weeks before last frost. Fall crops go in 6–8 weeks before first frost (${escapeHtml(firstFall)}).</p>
    </div>
    <div class="garden-species-group">
      <div class="garden-species-group-label">Warm Season (plant after ${escapeHtml(warmCutoff)})</div>
      <p class="prem-narrative-body">Tomatoes, peppers, squash, cucumbers, beans, corn, basil — plant outdoors after the last frost date. Start tomatoes and peppers indoors 6–8 weeks before the last frost date (${escapeHtml(lastSpring)}).</p>
    </div>
    <div class="garden-species-group">
      <div class="garden-species-group-label">Perennial Edibles — Plant Once, Harvest for Decades</div>
      <p class="prem-narrative-body">Asparagus: 3-year establishment, then productive for 20+ years. Rhubarb: plant crowns in early spring, harvest third year. Fruit trees: apple and pear reliably produce in Zone ${escapeHtml(zone.replace(/[ab]$/, ''))}. Elderberry: fast-growing native shrub, edible berries in year 2, excellent wildlife value.</p>
    </div>
    ${soilNote}
    <p class="prem-narrative-body">The local Cooperative Extension service offers free soil testing — worth doing before the first season.</p>`;
}

function buildBirdsTab(birdsBySeason, generalBirds) {
  const { yearRound = [], spring = [], summer = [], fall = [], winter = [] } = birdsBySeason || {};
  const hasSeasonalData = yearRound.length > 0 || spring.length > 0 || summer.length > 0 || fall.length > 0 || winter.length > 0;

  const birdRow = (b) =>
    `<div class="garden-species-item"><span class="garden-species-name">${escapeHtml(b.name)}</span> <em class="garden-species-sci">(${escapeHtml(b.sci)})</em></div>`;

  if (!hasSeasonalData) {
    const fallback = (generalBirds || []).slice(0, 8);
    const names = fallback.map((b) => escapeHtml(b.name)).join(', ');
    return `<p class="prem-narrative-body">${names ? `Common backyard birds observed within 10 miles: ${names}.` : 'Bird observation data is limited for this area.'}</p>
      <p class="prem-narrative-body">A platform feeder with black oil sunflower seeds attracts the widest range of species. Add a water source — especially in dry summers — and bird activity will increase noticeably.</p>
      <p class="prem-disclaimer">Based on iNaturalist research-grade observations.</p>`;
  }

  const bluebirds = [...yearRound, ...spring, ...summer].filter((b) => /bluebird/i.test(b.name));
  const bluebirdsNote = bluebirds.length
    ? `<div class="garden-species-group"><div class="garden-species-group-label">Bluebird Opportunity</div><p class="prem-narrative-body">Eastern Bluebirds are observed in your area. A bluebird box mounted on a 5-foot pole facing southeast, with a predator guard, placed in open grass at least 100 feet from tree line, gives you a strong chance of nesting pairs. Put it up by March 15 — they scout boxes early.</p></div>`
    : '';

  return `
    <p class="prem-narrative-body">These birds are observed within 10 miles — what's common here changes through the year as residents stay and migrants pass through.</p>
    ${yearRound.length ? `<div class="garden-species-group"><div class="garden-species-group-label">Year-Round Residents</div>${yearRound.map(birdRow).join('')}</div>` : ''}
    ${spring.length   ? `<div class="garden-species-group"><div class="garden-species-group-label">Spring Arrivals (April–May)</div>${spring.map(birdRow).join('')}</div>`    : ''}
    ${summer.length   ? `<div class="garden-species-group"><div class="garden-species-group-label">Summer Breeders (June–August)</div>${summer.map(birdRow).join('')}</div>` : ''}
    ${fall.length     ? `<div class="garden-species-group"><div class="garden-species-group-label">Fall Migrants (September–November)</div>${fall.map(birdRow).join('')}</div>` : ''}
    ${winter.length   ? `<div class="garden-species-group"><div class="garden-species-group-label">Winter Visitors (December–March)</div>${winter.map(birdRow).join('')}</div>` : ''}
    ${bluebirdsNote}
    <p class="prem-narrative-body">Feeder basics: black oil sunflower seeds attract the widest range. Suet attracts woodpeckers and nuthatches in winter. Fresh water is the single highest-value addition — especially May through September.</p>
    <p class="prem-disclaimer">Species from iNaturalist research-grade observations filtered by season (months 3–5 spring, 6–8 summer, 9–11 fall, 12–2 winter). Within 10 miles.</p>`;
}

function buildPollinatorsTab(butterflies, monarchCorridor, fireflyHabitat) {
  const butterflyItems = (butterflies || []).slice(0, 8).map((b) =>
    `<div class="garden-species-item"><span class="garden-species-name">${escapeHtml(b.name)}</span> <em class="garden-species-sci">(${escapeHtml(b.sci)})</em></div>`
  ).join('');

  const milkweeds = monarchCorridor?.milkweedSpecies || [];
  const monarchSection = monarchCorridor?.inCorridor ? `
    <div class="garden-species-group">
      <div class="garden-species-group-label">Monarch Butterfly Corridor</div>
      <p class="prem-narrative-body">This address is in the monarch migration corridor. Monarchs pass through in late summer and early fall on their way to Mexico. To support them: plant native milkweed (the only host plant for caterpillars) and avoid pesticides from July through October.</p>
      ${milkweeds.length
        ? `<p class="prem-narrative-body">Native milkweed species for this area: ${milkweeds.map(escapeHtml).join(', ')}.</p>`
        : `<p class="prem-narrative-body">Contact your local Cooperative Extension office for native milkweed recommendations for your region.</p>`}
      <p class="prem-narrative-body">Register as a Monarch Waystation at monarchwatch.org — requires at least 10 milkweed plants and nectar sources.</p>
    </div>` : '';

  const fireflySection = fireflyHabitat ? `
    <div class="garden-species-group">
      <div class="garden-species-group-label">Firefly Habitat</div>
      <p class="prem-narrative-body">Fireflies are native to this region and may appear in your yard from late May through July in moist areas. They need three things: moist soil for larvae, leaf litter in low areas, and darkness. Reduce lawn lighting, leave fallen leaves in corners or under trees, and avoid pesticide use in those areas.</p>
    </div>` : '';

  return `
    <p class="prem-narrative-body">Native pollinators are far more effective than honeybees for most native plants — they evolved together. Supporting them is as simple as growing the right plants and reducing pesticide use.</p>
    ${butterflyItems ? `<div class="garden-species-group"><div class="garden-species-group-label">Butterflies Observed Nearby</div>${butterflyItems}</div>` : ''}
    <div class="garden-species-group">
      <div class="garden-species-group-label">Native Bees</div>
      <p class="prem-narrative-body">Most native bees don't sting and are dramatically more efficient pollinators than honeybees for native plants. They need three things: bare ground (avoid landscape fabric), native flowers in bloom from spring through fall, and no broad-spectrum pesticides. A small brush pile or bee house provides nesting habitat for cavity-nesting species.</p>
    </div>
    ${monarchSection}
    ${fireflySection}
    <p class="prem-disclaimer">Butterfly species from iNaturalist research-grade observations (taxon 47224) within 10 miles.</p>`;
}

function buildWildlifeTab(wildlife, reptiles) {
  const mammalItems = (wildlife || []).slice(0, 8).map((w) =>
    `<div class="garden-species-item"><span class="garden-species-name">${escapeHtml(w.name)}</span> <em class="garden-species-sci">(${escapeHtml(w.sci)})</em></div>`
  ).join('');

  const reptileItems = (reptiles || []).slice(0, 8).map((r) =>
    `<div class="garden-species-item"><span class="garden-species-name">${escapeHtml(r.name)}</span> <em class="garden-species-sci">(${escapeHtml(r.sci)})</em></div>`
  ).join('');

  const hasDeer = (wildlife || []).some((w) => /deer/i.test(w.name));
  const deerNote = hasDeer
    ? '<p class="prem-narrative-body">Deer are active in this area. For vegetable gardens: 8-foot fencing is the only reliable solution. For ornamentals: deer-resistant natives include lavender, salvia, Russian sage, and most ornamental grasses. Avoid hostas, tulips, and daylilies without protection.</p>'
    : '';

  return `
    <p class="prem-narrative-body">These species are documented within 10 miles. Not all will visit your yard, but knowing what's present helps you plan — from what to plant to what to protect.</p>
    ${mammalItems ? `<div class="garden-species-group"><div class="garden-species-group-label">Mammals</div>${mammalItems}</div>` : ''}
    ${deerNote}
    ${reptileItems ? `<div class="garden-species-group"><div class="garden-species-group-label">Reptiles &amp; Amphibians</div>${reptileItems}</div>` : ''}
    <div class="garden-species-group">
      <div class="garden-species-group-label">The Beneficial Ones Worth Encouraging</div>
      <p class="prem-narrative-body">Virginia Opossum eats approximately 5,000 ticks per season and is almost never aggressive. Little Brown Bats eat 1,000 mosquitoes per hour — a bat box mounted 12–15 feet high on a south-facing surface is easy to install. Common Garter Snakes eat garden pests and are harmless. Toads eat roughly 10,000 insects per summer — a shallow water dish and some ground cover will attract them.</p>
    </div>
    <p class="prem-disclaimer">Species from iNaturalist research-grade observations within 10 miles.</p>`;
}

function buildSeasonalCalendarTab(hardinessZone, birdsBySeason, monarchCorridor) {
  const frost      = hardinessZone?.frost;
  const zone       = hardinessZone?.zone || '';
  const lastSpring = frost?.lastSpring || 'mid-April';
  const firstFall  = frost?.firstFall  || 'mid-October';
  const days       = frost?.days       || 180;

  const warmStart = days >= 180 ? 'May 1'   : 'May 15';
  const fallPlant = days >= 180 ? 'August 15–September 15' : 'August 1–September 1';
  const seedStart = lastSpring.includes('March') ? 'late January' : 'late February';

  const monarchNote = monarchCorridor?.inCorridor ? 'Monarchs peak migration southward. Milkweed is essential.' : '';
  const hummingNote = (birdsBySeason?.summer || []).some((b) => /hummingbird/i.test(b.name))
    ? 'Hummingbirds peak.' : '';

  const months = [
    { name: 'JANUARY',   body: `Dormant season. Winter birds active at feeders. Review last year's garden and order seeds now; popular varieties sell out by February. Start seeds indoors around ${escapeHtml(seedStart)} for spring planting.` },
    { name: 'FEBRUARY',  body: `Snowdrops and witch hazel may bloom. Red Maple buds swell — the first reliable sign of spring. Start tomato and pepper seeds indoors this month (8 weeks before last frost, ${escapeHtml(lastSpring)}). Order bare-root trees and shrubs for early spring planting.` },
    { name: 'MARCH',     body: `Eastern Redbud and serviceberry bloom early. First robins return. Plant cool-season crops outdoors after March 15 if temperatures are consistently above 40°F: spinach, kale, peas, lettuce. Put up bluebird boxes by March 15 — bluebirds scout early.` },
    { name: 'APRIL',     body: `Last frost average: ${escapeHtml(lastSpring)}. Do not plant frost-sensitive crops yet. Native columbine and Virginia Bluebells peak. Hummingbird feeders should be up by late April — early birds arrive before the flowers. Spring warbler migration peaks mid-April through early May.` },
    { name: 'MAY',       body: `Plant warm-season crops after ${escapeHtml(warmStart)}: tomatoes, peppers, squash, cucumbers, beans. Native bees emerge — peak pollinator activity begins. Fireflies appear late May in moist areas. ${hummingNote}` },
    { name: 'JUNE',      body: `Full garden season. Deep water 1–2 times per week rather than daily shallow watering — roots follow moisture downward. Native plants in their second year begin to take off with minimal care. Elderberries ripen late June.` },
    { name: 'JULY',      body: `Peak heat — water only in early morning. Goldenrod begins to bud. ${monarchNote || 'Monarchs increase.'} Hummingbird activity peaks. Mulch vegetable beds to retain moisture and suppress weeds.` },
    { name: 'AUGUST',    body: `${monarchNote || 'Monarchs peak migration southward.'} Asters begin blooming — critical late-season food for pollinators. Plant fall cool-season crops: ${escapeHtml(fallPlant)} for kale, spinach, lettuce, radish, broccoli.` },
    { name: 'SEPTEMBER', body: `Fall planting window closes around September 15. Peak fall warbler migration. Juncos arrive from Canada — reliable sign that winter is coming. Plant garlic now for next July harvest.` },
    { name: 'OCTOBER',   body: `First frost average: ${escapeHtml(firstFall)}. Harvest all frost-sensitive crops before first frost. Fall color peaks late October. Plant spring bulbs now: tulips, daffodils, crocus. Leave leaf litter in low areas for firefly larvae and toad habitat.` },
    { name: 'NOVEMBER',  body: `Dormancy begins. An excellent time for tree and shrub planting — roots establish through winter before spring growth demands energy. Winter birds establish at feeders. Cut back garden debris only partially — seed heads feed birds through winter.` },
    { name: 'DECEMBER',  body: `Cardinals and juncos at feeders daily. Evergreens provide important winter cover for birds. Plan next year's garden. Order seed catalogs. A layer of mulch over perennial beds protects crowns through freeze-thaw cycles.` },
  ];

  const monthRows = months.map((m) =>
    `<div class="garden-cal-month"><div class="garden-cal-month-name">${m.name}</div><div class="garden-cal-month-body">${m.body}</div></div>`
  ).join('');

  return `
    <p class="prem-narrative-body">A month-by-month guide specific to Zone ${escapeHtml(zone)} with your frost dates: last spring frost ${escapeHtml(lastSpring)}, first fall frost ${escapeHtml(firstFall)}.</p>
    <div class="garden-calendar">${monthRows}</div>`;
}

function buildInvasivesTab(invasivePlants) {
  if (!invasivePlants || !invasivePlants.length) {
    return `<p class="prem-narrative-body">No invasive plant observations were recorded in iNaturalist data for this area. Common invasives to watch for: Amur Honeysuckle, English Ivy, Japanese Honeysuckle, Tree-of-Heaven, and Japanese Knotweed — depending on your region.</p>`;
  }

  const items = invasivePlants.map((p) => {
    const guidance = getInvasiveGuidance(p.sci, p.name);
    return `
      <div class="garden-invasive-item">
        <div class="garden-invasive-name">${escapeHtml(p.name)} <em class="garden-species-sci">(${escapeHtml(p.sci)})</em></div>
        <p class="prem-narrative-body">${guidance}</p>
      </div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">These introduced species are frequently observed in this area and cause real problems once established. Worth recognizing on sight before you buy the property — some may already be present.</p>
    ${items}
    <p class="prem-disclaimer">Invasive species from iNaturalist research-grade introduced observations within 20 miles.</p>`;
}

function getInvasiveGuidance(sci, name) {
  const s = (sci || '').toLowerCase();
  if (s.includes('lonicera maackii') || s.includes('lonicera japonica')) {
    return `Amur and Japanese Honeysuckle leaf out 2–3 weeks before native plants and hold leaves 2–3 weeks after, blocking light nearly year-round. Remove in fall or early spring when leaves are visible and natives are dormant. Cut at base and immediately apply 25% glyphosate to the cut surface. Replace with: Spicebush (Lindera benzoin) or Coralberry (Symphoricarpos orbiculatus) — same understory role, native, bird habitat.`;
  }
  if (s.includes('ailanthus')) {
    return `Tree-of-Heaven grows 3–6 feet per year and produces thousands of winged seeds annually. Female trees should be cut in summer and stump-treated immediately with triclopyr or glyphosate. Seedlings can be hand-pulled when soil is moist. Replace with: native sumac species (Rhus) — similar form, excellent fall color, critical bird food.`;
  }
  if (s.includes('rosa multiflora')) {
    return `Multiflora Rose spreads aggressively by birds eating seeds and by arching canes rooting where they touch soil. Repeated cutting weakens plants over 2–3 years. Glyphosate applied to cut stumps in fall is more effective. Replace with: native rose species (Rosa carolina, Rosa palustris).`;
  }
  if (s.includes('hedera helix')) {
    return `English Ivy forms dense ground cover that shades out native plants and eventually climbs and kills trees. Cut all stems at the base in a ring around trees. Remove ground cover in sections — don't compost it. Replace with: native ginger (Asarum canadense) in shade; native sedges in sun.`;
  }
  if (s.includes('celastrus orbiculatus')) {
    return `Oriental Bittersweet girdles and kills trees by spiraling around trunks. Cut stems near the ground and treat cut surfaces with triclopyr. Remove seed-bearing stems by hand in fall before birds disperse seeds. Replace with: American Bittersweet (Celastrus scandens) — native, same visual appeal, supports songbirds.`;
  }
  if (s.includes('reynoutria') || s.includes('fallopia') || s.includes('polygonum cuspidatum')) {
    return `Japanese Knotweed has an extensive underground rhizome system — cutting alone stimulates regrowth. Repeated cutting every 2–3 weeks through the growing season for 3+ years can exhaust root reserves. Foliar glyphosate in late summer is the most effective chemical control. This is one of the most difficult invasives to eliminate.`;
  }
  if (s.includes('euonymus alatus')) {
    return `Burning Bush spreads by bird-dispersed seeds into natural areas. Remove before fruit sets (before September). Mechanical removal is effective for small plants. Replace with: native Fothergilla or Itea for fall color.`;
  }
  return `Frequently observed introduced species in this area. Remove before it produces seeds to limit spread. Check with your local Cooperative Extension service for species-specific removal guidance.`;
}

module.exports = { buildWhatWillGrowHTML, buildGardenDeepDiveHTML, buildGardenGlanceHTML };
