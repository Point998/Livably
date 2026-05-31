'use strict';
const { isValidHighwayName } = require('../../../src/modules/access/logic');

describe('isValidHighwayName', () => {
  test('matches exact highway name (uppercase)', () => {
    expect(isValidHighwayName('I-75, Georgetown, KY, USA', 'I-75')).toBe(true);
  });

  test('matches INTERSTATE N format', () => {
    expect(isValidHighwayName('Interstate 64, Richmond, VA, USA', 'I-64')).toBe(true);
  });

  test('matches I-N format within a longer string', () => {
    expect(isValidHighwayName('I-64 and I-75 interchange, Lexington, KY', 'I-64')).toBe(true);
  });

  test('matches I N (space) format', () => {
    expect(isValidHighwayName('I 65 near Nashville, TN', 'I-65')).toBe(true);
  });

  test('returns false for unrelated address', () => {
    expect(isValidHighwayName('Boat Ramp Road, Some City, KY, USA', 'I-75')).toBe(false);
  });

  test('returns false for empty address', () => {
    expect(isValidHighwayName('', 'I-75')).toBe(false);
  });

  test('returns false for null address', () => {
    expect(isValidHighwayName(null, 'I-75')).toBe(false);
  });

  test('does not cross-match different interstate number', () => {
    expect(isValidHighwayName('I-65, Louisville, KY, USA', 'I-64')).toBe(false);
  });
});
