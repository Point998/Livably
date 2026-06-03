'use strict';
const { buildHealthSafetyChapterHTML } = require('../../../src/modules/health/template');

const hospital = { name: 'Georgetown Community Hospital', driveTimeMinutes: 12, address: '100 Hospital Dr' };
const emergency = {
  fire:   { name: 'Georgetown Fire Station 1', distanceMiles: '1.2', address: '10 Fire St',   response: { estimate: 5,  category: { label: 'Excellent', color: 'green'  } } },
  police: { name: 'Georgetown Police Dept',    distanceMiles: '0.8', address: '20 Police Ave', response: { estimate: 4,  category: { label: 'Excellent', color: 'green'  } } },
};

describe('buildHealthSafetyChapterHTML — FR-045 depth system', () => {
  test('section has data-depth="overview"', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/data-depth="overview"/);
  });

  test('renders depth-l1 glance bar', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance bar shows ER drive time', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/12/);
    expect(html).toMatch(/min/i);
  });

  test('chapter-body has depth-l2 class', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/class="chapter-body depth-l2"/);
  });

  test('depth selector rendered', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/chapter-depth-control/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildHealthSafetyChapterHTML — urgentCare threading', () => {
  test('accepts urgentCare as third param without error', () => {
    const uc = { name: 'FastCare Urgent Care', address: '5 Clinic Rd', driveTimeMinutes: 8 };
    expect(() => buildHealthSafetyChapterHTML(hospital, emergency, uc)).not.toThrow();
  });
  test('accepts undefined urgentCare without error', () => {
    expect(() => buildHealthSafetyChapterHTML(hospital, emergency, undefined)).not.toThrow();
  });
});

const urgentCare = { name: 'FastCare Urgent Care', address: '5 Clinic Rd', driveTimeMinutes: 8 };
const urgentCareCrossState = {
  name: 'Ohio Urgent Care', address: '1 Ohio St', driveTimeMinutes: 22,
  crossStateWarning: true, crossStateNote: 'This urgent care is in OH. No in-state facility found within the search radius.',
};

describe('buildHealthSafetyChapterHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present when hospital present', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/depth-l3/);
  });

  test('health-deep-dive container rendered', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/health-deep-dive/);
  });

  test('Urgent Care tab rendered with name and drive time', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/Urgent Care/);
    expect(html).toMatch(/FastCare Urgent Care/);
    expect(html).toMatch(/8/);
  });

  test('Urgent Care tab shows fallback links when urgentCare is null', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, null);
    expect(html).toMatch(/solvhealth\.com/);
  });

  test('cross-state note shown when urgentCare is cross-state', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCareCrossState);
    expect(html).toMatch(/OH/);
  });

  test('Station Details tab rendered with fire station name', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/Station Details/);
    expect(html).toMatch(/Georgetown Fire Station 1/);
  });

  test('ISO Fire Rating tab always rendered', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/ISO Fire Rating/);
    expect(html).toMatch(/Public Protection Classification/);
  });

  test('ISO tab includes fire response time when fire data available', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/5.*min/);
  });

  test('Station Details tab absent when emergency is null', () => {
    const html = buildHealthSafetyChapterHTML(hospital, null, urgentCare);
    expect(html).not.toMatch(/Station Details/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildHealthSafetyChapterHTML — L4 research', () => {
  test('depth-l4 wrapper present when hospital present', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/depth-l4/);
  });

  test('facilities table rendered', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/climate-data-table/);
  });

  test('ER row in research table', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/Emergency Room/);
    expect(html).toMatch(/Georgetown Community Hospital/);
  });

  test('urgent care row in research table when provided', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/FastCare Urgent Care/);
  });

  test('urgent care row absent when urgentCare is null', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, null);
    expect(html).toMatch(/Emergency Room/);
    expect(html).not.toMatch(/FastCare/);
  });

  test('fire station row in research table', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    expect(html).toMatch(/Fire Station/);
    expect(html).toMatch(/Georgetown Fire Station 1/);
  });

  test('L4 absent when no data at all', () => {
    const html = buildHealthSafetyChapterHTML(null, null, null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildHealthSafetyChapterHTML — Healthcare Ecosystem tab', () => {
  test('Healthcare Ecosystem tab rendered when hospital present', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, null);
    expect(html).toMatch(/Healthcare Ecosystem/);
  });

  test('CMS Care Compare link always present', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, null);
    expect(html).toMatch(/care-compare/);
  });

  test('designation label rendered when designation present', () => {
    const depth = { designation: { label: 'Acute Care Hospital', note: 'Equipped for most emergencies.' }, primaryCareCount: 12 };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    expect(html).toMatch(/Acute Care Hospital/);
  });

  test('designation note rendered when designation present', () => {
    const depth = { designation: { label: 'Critical Access Hospital', note: 'Smaller rural hospital.' }, primaryCareCount: 3 };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    expect(html).toMatch(/Smaller rural hospital/);
  });

  test('primary care count rendered when available', () => {
    const depth = { designation: null, primaryCareCount: 18 };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    expect(html).toMatch(/18/);
  });

  test('low primary care count triggers limited-slots framing', () => {
    const depth = { designation: null, primaryCareCount: 3 };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    expect(html).toMatch(/3/);
    expect(html).toMatch(/Competition for new patient slots/i);
  });

  test('null primaryCareCount shows data unavailable message', () => {
    const depth = { designation: null, primaryCareCount: null };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    expect(html).toMatch(/data was not available/i);
  });

  test('tab rendered when healthcareDepth is null (graceful degradation)', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, null);
    expect(html).toMatch(/Healthcare Ecosystem/);
    expect(html).toMatch(/care-compare/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const depth = { designation: { label: 'Acute Care Hospital', note: 'Equipped.' }, primaryCareCount: 10 };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('existing urgentCare tab still present with 4th param', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, null);
    expect(html).toMatch(/Urgent Care/);
  });
});
