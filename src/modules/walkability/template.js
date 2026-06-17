'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderChapterCard } = require('../../templates/components/chapterCard');

// FR-067 — provenance-aware disclaimer source phrase. OSM data is community-
// mapped and may be less complete than commercial data; say so plainly rather
// than implying Google-grade precision (honest-provenance principle).
function walkSourcePhrase(source) {
  return source === 'osm'
    ? 'OpenStreetMap (community-mapped) data — may be less complete than commercial sources'
    : 'Google Places data';
}

function getPedestrianFeatures(score) {
  if (score >= 90) return {
    present: ['Well-connected sidewalk network', 'Marked crosswalks throughout', 'Pedestrian signals at intersections', 'Street lighting on main routes'],
    note: null,
  };
  if (score >= 70) return {
    present: ['Sidewalks on most streets', 'Crosswalks at main intersections', 'Street lighting available'],
    note: 'Verify sidewalk coverage on residential side streets',
  };
  if (score >= 50) return {
    present: ['Sidewalks on main roads', 'Some pedestrian crossings'],
    note: 'Sidewalk coverage may be limited on some side streets',
  };
  if (score >= 25) return {
    present: ['Sidewalks on select main roads'],
    note: 'Most walking routes require sharing the roadway — plan routes carefully',
  };
  return {
    present: [],
    note: 'Limited pedestrian infrastructure in this area — verify routes before walking',
  };
}

function buildWalkBeforeClosingTab(walk) {
  const { score } = walk;

  const scoreContext = score >= 70
    ? 'The destinations nearby are genuine and close. The main thing to verify is route quality — sidewalk continuity, crossing conditions, and lighting.'
    : score >= 50
    ? "Walking is situationally useful here. Before closing, identify the specific trips you'd actually make on foot and test each one."
    : 'Car-dependency is the reality here. Still worth verifying what walking looks like for exercise, leisure, and occasional short trips.';

  const items = [
    {
      icon: '🚶',
      title: 'Walk your top destinations',
      detail: `Use the estimated walk times as a starting point, then test each route yourself. Grade changes, sidewalk gaps, and intersection wait times can make a route feel longer than the numbers suggest. ${scoreContext}`,
    },
    {
      icon: '🌃',
      title: 'Visit in the evening',
      detail: "Lighting, traffic pace, and pedestrian density shift after dark. If you'd be walking to a restaurant, transit stop, or gym at night, verify the route in those conditions — not just on a sunny weekend afternoon.",
    },
    {
      icon: '📱',
      title: 'Preview routes in Street View',
      detail: 'Before your next property visit, use Google Maps Street View to walk routes from the front door. Look for sidewalk gaps that force pedestrians into the road, construction blocking paths, and intersection crossing quality.',
    },
    {
      icon: '🚌',
      title: 'Verify transit frequency if it applies',
      detail: "If you're planning to supplement walking with transit, check specific route frequency and hours — not just that a stop exists. A bus that runs twice per day changes the math significantly. Use your city's transit authority app, not just Google Maps.",
    },
    {
      icon: '♿',
      title: 'Check accessibility if relevant',
      detail: 'If anyone in your household has mobility limitations, walk each route to verify curb cuts at crossings, ramp conditions, and surface continuity. ADA compliance does not guarantee day-to-day navigability.',
    },
  ];

  const rows = items.map((it) => `
    <div class="safety-prep-item">
      <div class="safety-prep-item-hd">
        <span class="safety-prep-item-icon">${it.icon}</span>
        <span class="safety-prep-item-title">${escapeHtml(it.title)}</span>
      </div>
      <p class="safety-prep-item-detail">${it.detail}</p>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">Walk time data describes the address, not the experience on foot. These are the things worth verifying in person before closing.</p>
    ${rows}`;
}

function buildWalkResearchToolsTab() {
  const items = [
    {
      icon: '📊',
      title: 'Walk Score',
      detail: 'The industry-standard walkability database. Enter any US address to see Walk Score, Transit Score, and Bike Score with a breakdown of nearby amenities. More granular than proximity estimates for comparing walkability across addresses.',
      url: 'https://www.walkscore.com/',
    },
    {
      icon: '🗺️',
      title: 'Google Maps Street View',
      detail: 'Walk your routes before visiting. Drag the orange pegman onto any street to see ground-level conditions — sidewalk continuity, crossing infrastructure, and grade changes. Useful for previewing routes to the destinations listed above.',
      url: 'https://maps.google.com/',
    },
    {
      icon: '🚌',
      title: 'City transit trip planner',
      detail: "Search \"[your city] transit trip planner\" to find your local transit authority's official app. More accurate than Google Maps for real schedules and real-time service status. Check frequency and hours, not just whether a route exists.",
      url: null,
    },
    {
      icon: '🗂️',
      title: 'OpenStreetMap pedestrian layer',
      detail: 'A detailed community-mapped database of pedestrian infrastructure — sidewalks, footpaths, crossings, and pedestrian zones. Use the Transport map layer to see pedestrian routing in your specific area.',
      url: 'https://www.openstreetmap.org/',
    },
    {
      icon: '📋',
      title: 'City 311 / sidewalk inventory',
      detail: 'Search "[your city] 311 sidewalk" or "[your city] sidewalk inventory." Many cities maintain public records of reported sidewalk damage, planned repairs, and infrastructure gaps.',
      url: null,
    },
  ];

  const rows = items.map((it) => {
    const titleContent = it.url
      ? `<a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.title)}</a>`
      : escapeHtml(it.title);
    return `
    <div class="sensory-research-item">
      <div class="sensory-research-item-hd">
        <span class="sensory-research-item-icon">${it.icon}</span>
        <span class="sensory-research-item-title">${titleContent}</span>
      </div>
      <p class="sensory-research-item-detail">${it.detail}</p>
    </div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">These tools let you go deeper on walkability and pedestrian conditions at this specific address.</p>
    ${rows}`;
}

function buildWalkResearchHTML(walk) {
  if (!walk?.destinations?.length) return '';
  const { destinations } = walk;

  const rows = destinations.map((d) => {
    const distDisplay = d.distanceMiles < 0.2
      ? `${Math.round(d.distanceMiles * 5280)} ft`
      : `${d.distanceMiles.toFixed(1)} mi`;
    return `
    <tr>
      <td>${escapeHtml(d.label)}</td>
      <td>${escapeHtml(d.name)}</td>
      <td>${d.walkMinutes} min</td>
      <td>${distDisplay}</td>
    </tr>`;
  }).join('');

  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">All Walkable Destinations</div>
      <div class="climate-table-scroll">
        <table class="climate-data-table">
          <thead><tr><th>Category</th><th>Name</th><th>Walk Time</th><th>Distance</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="prem-disclaimer">Walk times estimated from straight-line distance at average pedestrian pace. Not based on official Walk Score® data. Source: ${escapeHtml(walkSourcePhrase(walk.source))}.</p>
    </div>`;
}

function buildWalkDeepDiveHTML(walk) {
  if (!walk) return '';

  const tabs = [
    { id: 'verify',   label: 'Walk Before Closing', content: buildWalkBeforeClosingTab(walk) },
    { id: 'research', label: 'Research Tools',       content: buildWalkResearchToolsTab() },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="wktab-${t.id}" id="wkbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="wktab-${t.id}" role="tabpanel" aria-labelledby="wkbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="walk-deep-dive">
      <div class="walk-deep-dive-label">Walking in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Walkability chapter deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}

// FR-067 — both data sources down. Render an actionable card (no fabricated
// score band) pointing at the research tools, per CONSTRAINT-015.
function buildWalkabilityUnavailableHTML(walk) {
  const walkSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="M8 22l2-7 3 3 3-4 2 8"/><path d="M7.5 13.5L9 11l4 1 2-3.5"/></svg>`;
  const leftHTML = `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">We couldn't retrieve nearby-amenity data for this address right now, so we can't estimate walkability automatically. This is a temporary data gap, not a finding about the location.</p>
      <p class="prem-narrative-body">You can get an authoritative walkability read in a couple of minutes using the tools below — Walk Score covers any US address, and Google Street View lets you preview specific routes from the front door.</p>
    </div>
    <div class="depth-l3">${buildWalkResearchToolsTab()}</div>`;
  return renderChapterCard('walk', '13', walkSvg, 'Getting Around on Foot', 'What\'s reachable without a car — and what that means for daily life.', null, leftHTML, null, null, null, null);
}

function buildWalkabilityHTML(walk) {
  if (!walk) return '';
  if (walk.source === 'unavailable' || walk.score == null) return buildWalkabilityUnavailableHTML(walk);
  const { score, category, destinations } = walk;

  const verdictMod = ['green', 'lightgreen', 'gold', 'orange', 'red'].includes(category.color) ? category.color : 'gold';

  // Bucket destinations by walk time for narrative use
  const nearby = (destinations || []).filter((d) => d.walkMinutes <= 10);
  const reachable = (destinations || []).filter((d) => d.walkMinutes > 10 && d.walkMinutes <= 20);

  // Lead paragraph: the felt experience
  let para1HTML;
  if (score >= 70) {
    const examples = nearby.length
      ? `${nearby.slice(0, 2).map((d) => `${escapeHtml(d.name)} (${d.walkMinutes} min)`).join(' and ')} ${nearby.length > 1 ? 'are' : 'is'} reachable on foot without a second thought. `
      : '';
    para1HTML = `<p class="prem-narrative-lead">${examples}Walking here is practical, not aspirational. Morning coffee, a quick errand, an evening stroll—these happen without involving the car. That low-friction access compounds quietly: you stop thinking about it after a week, and start missing it immediately if you ever move somewhere without it.</p>`;
  } else if (score >= 50) {
    const firstDest = (destinations || [])[0];
    const example = firstDest ? `${escapeHtml(firstDest.name)} is ${firstDest.walkMinutes} minutes on foot. ` : '';
    para1HTML = `<p class="prem-narrative-lead">${example}Walking is a realistic option here—for some trips, on some days. It's a pleasant supplement to a car-based routine, not a replacement for it. On a nice evening or a relaxed weekend morning, you'll use your feet. On a typical Tuesday errand run, you'll drive.</p>`;
  } else if (score >= 30) {
    para1HTML = `<p class="prem-narrative-lead">This is car-dependent territory. Not because it's unwalkable for exercise or leisure—it's fine for that—but because the distances and infrastructure don't support walking as a way to run errands or access daily services. Plan your life around the car, and enjoy the walking for what it is: recreation, not transportation.</p>`;
  } else {
    para1HTML = `<p class="prem-narrative-lead">Walking to daily services isn't part of the picture here. The distances are long, the pedestrian infrastructure is limited, and that's simply the character of this kind of location. What it offers instead—space, quiet, nature—is a different kind of value. Most people who choose somewhere like this have already made that trade-off consciously.</p>`;
  }

  // Second paragraph: what IS and ISN'T walkable
  let para2HTML = '';
  if (score >= 70 && (nearby.length || reachable.length)) {
    const nearbyNames = nearby.map((d) => escapeHtml(d.name)).join(', ');
    const reachableNames = reachable.map((d) => escapeHtml(d.name)).join(', ');
    let text = '';
    if (nearbyNames) text += `Within easy walking distance: ${nearbyNames}.`;
    if (reachableNames) text += ` A bit further but still walkable: ${reachableNames}.`;
    if (text) text += ' A full grocery haul or anything that needs a car seat still gets driven—walkability here doesn\'t eliminate the car, it just reduces how often you reach for the keys.';
    if (text) para2HTML = `<p class="prem-narrative-body">${text}</p>`;
  } else if (score >= 50 && (destinations || []).length) {
    const destNames = (destinations || []).slice(0, 3).map((d) => escapeHtml(d.name)).join(', ');
    para2HTML = `<p class="prem-narrative-body">The walkable options nearby—${destNames}—are genuinely useful when the timing is right, but they don't add up to a fully walkable lifestyle. Most daily needs still require a car trip.</p>`;
  } else if (score < 30 && (destinations || []).length) {
    const destNames = (destinations || []).slice(0, 2).map((d) => escapeHtml(d.name)).join(' and ');
    para2HTML = `<p class="prem-narrative-body">${destNames ? `The closest options on foot are ${destNames}—` : ''}worth knowing for a neighborhood stroll, but not practical for regular errands given the distances involved.</p>`;
  }

  // Third paragraph: honest reality / anticipation
  let para3HTML;
  if (score >= 70) {
    para3HTML = `<p class="prem-narrative-body">One thing walkability ratings can't fully capture: the quality of the experience. Sidewalk continuity, shade, lighting, and how the streets feel matter as much as what's nearby. The pedestrian environment details below give you a ground-level picture of what walking here actually feels like.</p>`;
  } else if (score >= 50) {
    para3HTML = `<p class="prem-narrative-body">If walkability matters to you but this location is otherwise right, most people adapt to car-based routines easily. Where it surfaces more is for teenagers who can't drive yet, elderly family members who may stop driving, or anyone who values the independence of not needing a car for daily life.</p>`;
  } else {
    para3HTML = `<p class="prem-narrative-body">Worth naming clearly: in a car-dependent location, anyone who doesn't or can't drive is significantly constrained. That's a real quality-of-life factor for families with teenagers, for aging in place, and for any household member who loses driving ability. Worth thinking about before committing.</p>`;
  }

  const destHTML = (destinations || []).length ? `
    <div class="prem-walk-section-label">What's Within Walking Distance</div>
    <div class="prem-walk-dests">
      ${destinations.map((d) => {
        const distDisplay = d.distanceMiles < 0.2
          ? `${Math.round(d.distanceMiles * 5280)} ft`
          : `${d.distanceMiles.toFixed(1)} mi`;
        return `
      <div class="prem-walk-dest">
        <span class="prem-walk-dest-icon">${d.icon}</span>
        <div class="prem-walk-dest-info">
          <div class="prem-walk-dest-name">${escapeHtml(d.name)}</div>
          <div class="prem-walk-dest-cat">${escapeHtml(d.label)}</div>
        </div>
        <div class="prem-walk-dest-time">${d.walkMinutes} min walk<div class="prem-walk-dest-dist">${distDisplay}</div></div>
      </div>`;
      }).join('')}
    </div>` : '';

  const features = getPedestrianFeatures(score);
  const featHTML = `
    <div class="prem-walk-section-label">Pedestrian Environment</div>
    <div class="prem-walk-features">
      ${features.present.map((f) => `<div class="prem-walk-feature prem-walk-feat-yes">✓ ${escapeHtml(f)}</div>`).join('')}
      ${features.note ? `<div class="prem-walk-feature prem-walk-feat-note">◎ ${escapeHtml(features.note)}</div>` : ''}
    </div>`;

  const walkFullHTML = `
    <div class="walk-verdict-block">
      <div class="prem-walk-verdict walk-verdict--${verdictMod}">${escapeHtml(category.label)}</div>
      <div class="walk-display-label">${escapeHtml(category.description)}</div>
    </div>`;

  const walkLeftHTML = `
    <div class="prem-narrative">
      ${para1HTML}
      ${para2HTML}
      ${para3HTML}
    </div>
    ${destHTML}
    ${featHTML}
    <p class="prem-disclaimer">Walkability is estimated from nearby amenities within 0.5 miles using ${escapeHtml(walkSourcePhrase(walk.source))}. Not an official Walk Score®.</p>`;

  const walkSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="M8 22l2-7 3 3 3-4 2 8"/><path d="M7.5 13.5L9 11l4 1 2-3.5"/></svg>`;
  const deepDiveHTML = buildWalkDeepDiveHTML(walk);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
  const researchHTML = buildWalkResearchHTML(walk);
  const l4HTML = researchHTML ? `<div class="depth-l4">${researchHTML}</div>` : '';
  const fullHTML = [walkFullHTML, l3HTML, l4HTML].filter(Boolean).join('');

  const glanceHTML = buildWalkGlanceHTML(walk);
  return renderChapterCard('walk', '13', walkSvg, 'Getting Around on Foot', 'What\'s reachable without a car — and what that means for daily life.', null, walkLeftHTML, null, fullHTML || null, null, glanceHTML || null);
}

function buildWalkGlanceHTML(walk) {
  if (!walk?.category) return '';
  return `<div class="chapter-glance">
    <span class="chapter-glance-item"><span class="prem-badge badge-${escapeHtml(walk.category.color)}">${escapeHtml(walk.category.label)}</span></span>
    <span class="chapter-glance-sep">·</span>
    <span class="chapter-glance-item">${escapeHtml(walk.category.description)}</span>
  </div>`;
}

module.exports = { buildWalkabilityHTML, buildWalkGlanceHTML };
