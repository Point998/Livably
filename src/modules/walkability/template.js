'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderChapterCard } = require('../../templates/components/chapterCard');

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

function buildWalkabilityHTML(walk) {
  if (!walk) return '';
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
    <p class="prem-disclaimer">Walkability is estimated from nearby amenities within 0.5 miles using Google Places data. Not an official Walk Score®.</p>`;

  const walkSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="M8 22l2-7 3 3 3-4 2 8"/><path d="M7.5 13.5L9 11l4 1 2-3.5"/></svg>`;
  const glanceHTML = buildWalkGlanceHTML(walk);
  return renderChapterCard('walk', '13', walkSvg, 'Getting Around on Foot', 'What\'s reachable without a car — and what that means for daily life.', null, walkLeftHTML, null, walkFullHTML, null, glanceHTML || null);
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
