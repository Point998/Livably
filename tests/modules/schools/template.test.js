'use strict';
const { buildSchoolRatingsHTML } = require('../../../src/modules/schools/template');

const baseSchools = {
  public: [
    {
      name: 'Georgetown Elementary',
      level: 'Elementary',
      address: '100 School Rd, Georgetown, KY',
      distanceMiles: '1.2',
      driveTimeMinutes: 6,
    },
  ],
  private: [],
};

const fullSchools = {
  public: [
    { name: 'Georgetown Elementary', level: 'Elementary', address: '100 School Rd, Georgetown, KY', distanceMiles: '1.2', driveTimeMinutes: 6 },
    { name: 'Georgetown Middle',     level: 'Middle',     address: '200 School Rd, Georgetown, KY', distanceMiles: '2.4', driveTimeMinutes: 9 },
    { name: 'Scott County High',     level: 'High',       address: '300 High School Dr, Georgetown, KY', distanceMiles: '3.1', driveTimeMinutes: 12 },
  ],
  private: [
    { name: 'Calvary Christian Academy', distanceMiles: '4.2', address: '10 Faith Dr, Georgetown, KY' },
  ],
};

describe('buildSchoolRatingsHTML — FR-045 glance bar', () => {
  test('renders chapter-glance in depth-l1', () => {
    const html = buildSchoolRatingsHTML(baseSchools);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance shows drive time for nearest school', () => {
    const html = buildSchoolRatingsHTML(baseSchools);
    expect(html).toMatch(/Georgetown Elementary/);
    expect(html).toMatch(/6 min/);
  });

  test('glance shows assigned school warning', () => {
    const html = buildSchoolRatingsHTML(baseSchools);
    expect(html).toMatch(/district verification/i);
  });

  test('glance omits nearest school item when no public schools', () => {
    const html = buildSchoolRatingsHTML({ public: [], private: [] });
    expect(html).toMatch(/chapter-glance/);
    expect(html).not.toMatch(/Nearest:/);
  });

  test('returns empty string when schools is null', () => {
    const html = buildSchoolRatingsHTML(null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSchoolRatingsHTML(baseSchools);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildSchoolRatingsHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/depth-l3/);
  });

  test('school-deep-dive container rendered', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/school-deep-dive/);
  });

  test('Research Tools tab rendered', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/Research Tools/);
  });

  test('GreatSchools link rendered for each public school', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/greatschools\.org/);
    expect(html).toMatch(/Georgetown Elementary/);
  });

  test('NCES link rendered', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/nces\.ed\.gov/);
  });

  test('Enrollment Timeline tab rendered', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/Enrollment Timeline/);
  });

  test('timeline items present', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    expect(html).toMatch(/private school/i);
    expect(html).toMatch(/district/i);
  });

  test('L3 present even with only one public school', () => {
    const html = buildSchoolRatingsHTML(baseSchools);
    expect(html).toMatch(/depth-l3/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildSchoolRatingsHTML(fullSchools);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
