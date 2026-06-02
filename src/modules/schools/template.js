'use strict';
const { escapeHtml } = require('../../utils/text');
const { renderChapterCard } = require('../../templates/components/chapterCard');

function buildSchoolResearchToolsTab(schools) {
  const publicSchools = schools?.public?.filter(Boolean) || [];

  const schoolLinks = publicSchools.map(s => {
    const query = encodeURIComponent(s.name);
    return `
      <div class="school-research-item">
        <div class="school-research-item-hd">
          <span class="school-research-item-name">${escapeHtml(s.name)}</span>
          <span class="school-research-item-level">${escapeHtml(s.level)}</span>
        </div>
        <div class="school-research-item-link">
          <a href="https://www.greatschools.org/search/search.page?q=${query}" target="_blank" rel="noopener noreferrer">Search on GreatSchools →</a>
        </div>
      </div>`;
  }).join('');

  return `
    <p class="prem-narrative-body">GreatSchools ratings summarize test performance and equity metrics — useful as a starting point, but factor in parent reviews and a site visit before drawing conclusions.</p>
    ${schoolLinks || '<p class="prem-narrative-body">No public schools found — search GreatSchools.org directly with your address.</p>'}
    <p class="prem-narrative-body"><a href="https://nces.ed.gov/ccd/schoolsearch/" target="_blank" rel="noopener noreferrer">NCES School Search</a> — Federal database of public school enrollment, demographics, and staffing data. No ratings, just raw counts.</p>
    <p class="prem-narrative-body">Your state's Department of Education publishes annual school report cards. Search "<em>[state] school report card [school name]</em>" to find the official version.</p>
    <p class="prem-disclaimer">Ratings and data are updated annually and reflect a snapshot in time. Teaching staff, programs, and school culture change faster than published data.</p>`;
}

function buildSchoolEnrollmentTab() {
  const items = [
    { when: '12–18 months before',       what: 'Start researching private school options. Most selective schools open applications in the fall for the following school year — inquire early.' },
    { when: '6–12 months before',        what: 'Submit private school applications. Waitlists fill quickly. If you\'re targeting a specific private school, this is the window that matters.' },
    { when: 'After offer accepted',       what: 'Call the district office immediately with your exact address and ask which school your parcel is zoned to at each level. Don\'t assume — boundaries split streets.' },
    { when: 'Feb–April (most districts)', what: 'Public school enrollment windows for the coming year open. Submit any open-enrollment or magnet program applications in this window.' },
    { when: 'Before closing',             what: 'Ask the district about any pending boundary changes or redistricting plans. Changes can affect which school your children attend starting the very next year.' },
    { when: 'Before school starts',       what: 'Contact the school directly to confirm after-school care availability, pickup times, and waitlist status. These fill up fast and have direct impact on work schedules.' },
  ];

  const rows = items.map(it => `
    <div class="school-timeline-item">
      <div class="school-timeline-when">${escapeHtml(it.when)}</div>
      <div class="school-timeline-what">${escapeHtml(it.what)}</div>
    </div>`).join('');

  return `
    <p class="prem-narrative-body">School enrollment has hard deadlines that don't flex around real estate timelines. Here's the calendar to plan around.</p>
    ${rows}
    <p class="prem-disclaimer">Timelines are typical for US school districts. Verify specific dates with your district and target schools — they vary by state and district policy.</p>`;
}

function buildSchoolDeepDiveHTML(schools) {
  if (!schools) return '';

  const tabs = [
    { id: 'research', label: 'Research Tools',      content: buildSchoolResearchToolsTab(schools) },
    { id: 'timeline', label: 'Enrollment Timeline', content: buildSchoolEnrollmentTab() },
  ];

  const tabButtons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-controls="sdtab-${t.id}" id="sdbtn-${t.id}">${t.label}</button>`
  ).join('');

  const tabPanels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="sdtab-${t.id}" role="tabpanel" aria-labelledby="sdbtn-${t.id}">${t.content}</div>`
  ).join('');

  return `
    <div class="school-deep-dive">
      <div class="school-deep-dive-label">Schools in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Schools chapter deep dive">
        ${tabButtons}
      </nav>
      <div class="climate-tab-panels">
        ${tabPanels}
      </div>
    </div>`;
}

function buildSchoolRatingsHTML(schools) {
  if (!schools) return '';
  const publicSchools  = schools.public  || [];
  const privateSchools = schools.private || [];
  const nearest = publicSchools.find((s) => s != null);

  // ── Assigned school alert ─────────────────────────────────────────────────
  const assignedAlertHTML = `
    <div class="prem-school-assigned-alert">
      <div class="prem-school-assigned-icon">⚠️</div>
      <div class="prem-school-assigned-text">
        <strong>Nearest school is not necessarily your assigned school.</strong>
        Attendance boundaries don't follow distance logic — a school 0.5 miles away may serve a different zone. Before making any decision based on a specific school, call the district office with your exact address.
        <div class="prem-school-assigned-action">Action: Call <strong>the district office</strong> with your address and ask which school your parcel is zoned to — takes 5 minutes.</div>
      </div>
    </div>`;

  // ── Lead narrative ────────────────────────────────────────────────────────
  const narrativeHTML = nearest ? `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">The nearest public ${nearest.level.toLowerCase()} school is ${nearest.driveTimeMinutes != null ? `${nearest.driveTimeMinutes} minute${nearest.driveTimeMinutes !== 1 ? 's' : ''} away` : `${nearest.distanceMiles} miles away`}—${nearest.driveTimeMinutes != null && nearest.driveTimeMinutes <= 5 ? 'close enough that walking or biking is realistic on good weather days' : nearest.driveTimeMinutes != null && nearest.driveTimeMinutes <= 10 ? 'a quick drive that fits easily into any morning routine' : nearest.driveTimeMinutes != null && nearest.driveTimeMinutes <= 15 ? 'a manageable commute once you know the route' : 'a commute worth timing on a real school morning'}. The listings below show the nearest school at each level — not your assigned school.</p>
      <p class="prem-narrative-body">What the data doesn't tell you: average class size, after-school care cutoff times, or how active the parent community is. These are often the deciding factors for families, and none appear in any public directory. Schedule a tour on a regular school day and talk to parents at afternoon pickup — that's where you get the real picture.</p>
    </div>` : '';

  // ── Public school cards ───────────────────────────────────────────────────
  const publicItems = publicSchools.map((s) => {
    if (!s) return '';
    return `
    <div class="prem-school-card">
      <div class="prem-school-header">
        <div class="prem-school-level">Public ${escapeHtml(s.level)} School</div>
        <div class="prem-school-name">${escapeHtml(s.name)}</div>
        <div class="prem-school-addr">${escapeHtml(s.address)}</div>
        <div class="prem-school-meta">
          <span class="prem-school-dist">${escapeHtml(s.distanceMiles)} mi away</span>
          ${s.driveTimeMinutes != null ? `<span class="prem-school-time">${s.driveTimeMinutes} min drive</span>` : ''}
        </div>
      </div>
    </div>`;
  }).filter(Boolean).join('');

  // ── Private school section ────────────────────────────────────────────────
  let privateHTML = '';
  if (privateSchools.length > 0) {
    const privateItems = privateSchools.map((s) => `
      <div class="prem-school-choice-item">
        <div class="prem-school-choice-name">${escapeHtml(s.name)}</div>
        <div class="prem-school-choice-meta">${escapeHtml(s.distanceMiles)} mi away · ${escapeHtml(s.address)}</div>
      </div>`).join('');
    privateHTML = `
    <div class="prem-school-choice-section">
      <div class="prem-school-choice-label">Private Schools Within 10 Miles</div>
      ${privateItems}
      <p class="prem-school-choice-note">Contact each school directly for tuition, enrollment, and admissions timelines. Most private schools require applications 6–12 months before the school year starts.</p>
    </div>`;
  }

  // ── Questions to ask checklist ────────────────────────────────────────────
  const checklistHTML = `
    <div class="prem-safety-actions">
      <div class="prem-safety-actions-label">4 Questions to Ask Before You Close</div>
      <div class="prem-safety-action">
        <div class="prem-safety-action-icon">🏫</div>
        <div>
          <div class="prem-safety-action-label">Confirm your assigned school</div>
          <div class="prem-safety-action-detail">Call the district office with your exact address — ask which school your specific parcel is zoned to at each level. Boundaries can split streets.</div>
        </div>
      </div>
      <div class="prem-safety-action">
        <div class="prem-safety-action-icon">📐</div>
        <div>
          <div class="prem-safety-action-label">Ask about boundary stability</div>
          <div class="prem-safety-action-detail">Ask the district: "Have boundaries changed in the last 5 years?" and "Are any redistricting plans in review?" Kids switching schools mid-elementary is a real disruption.</div>
        </div>
      </div>
      <div class="prem-safety-action">
        <div class="prem-safety-action-icon">⏰</div>
        <div>
          <div class="prem-safety-action-label">Check after-school care availability</div>
          <div class="prem-safety-action-detail">Ask the school's front office: Is on-site care available? What are the pickup cutoff times and cost? This is often a dealbreaker for working parents and has a waitlist.</div>
        </div>
      </div>
      <div class="prem-safety-action">
        <div class="prem-safety-action-icon">👥</div>
        <div>
          <div class="prem-safety-action-label">Talk to current parents</div>
          <div class="prem-safety-action-detail">Walk the school at afternoon pickup. Ask parents what they wish they'd known. Class size, teacher turnover, and community involvement don't appear in any public database.</div>
        </div>
      </div>
    </div>`;

  // ── Key Takeaway ──────────────────────────────────────────────────────────
  let takeawayText = '';
  if (nearest && nearest.driveTimeMinutes != null) {
    takeawayText = nearest.driveTimeMinutes <= 5
      ? `The nearest public ${nearest.level.toLowerCase()} school is just ${nearest.driveTimeMinutes} minutes away — but confirm your assigned school with the district before treating that as your actual option.`
      : nearest.driveTimeMinutes <= 12
      ? `Public schools are within a reasonable drive, but your assigned school may differ from the nearest one. Confirm your zone before factoring any specific school into your decision.`
      : `School commutes here are on the longer side. Confirm your assigned school with the district — and explore private options if public commute times are a concern.`;
  } else if (publicSchools.some(Boolean)) {
    takeawayText = 'Schools are accessible in this area. Before relying on any specific school, verify your assigned zone with the district — nearest school and assigned school are often different.';
  }

  const takeawayHTML = takeawayText ? `
    <div class="key-takeaway">
      <span class="kt-icon">🔑</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${escapeHtml(takeawayText)}</div>
    </div>` : '';

  const body = `
    ${assignedAlertHTML}
    ${narrativeHTML}
    <div class="prem-school-section-label">Nearest Public Schools</div>
    ${publicItems || '<p class="prem-na">No public schools found within search radius.</p>'}
    ${privateHTML}
    ${checklistHTML}
    ${takeawayHTML}`;

  const bookSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="--path-len:90" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
  const glanceHTML = buildSchoolGlanceHTML(schools);
  const deepDiveHTML = buildSchoolDeepDiveHTML(schools);
  const l3HTML = deepDiveHTML ? `<div class="depth-l3">${deepDiveHTML}</div>` : '';
  return renderChapterCard('school', '05', bookSvg, 'Schools & Education', 'What you need to know before their first day.', null, body, null, l3HTML || null, null, glanceHTML || null);
}

function buildSchoolGlanceHTML(schools) {
  if (!schools) return '';
  const first = (schools.public || []).find(Boolean);
  const driveMins = first?.driveTimeMinutes != null ? `${first.driveTimeMinutes} min` : null;
  return `<div class="chapter-glance">
    <span class="chapter-glance-item">⚠ Assigned school requires district verification</span>
    ${driveMins ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">Nearest: ${escapeHtml(first.name)} — ${escapeHtml(driveMins)}</span>` : ''}
  </div>`;
}

module.exports = { buildSchoolRatingsHTML };
