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
