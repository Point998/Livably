'use strict';
const { safeInt } = require('../../src/utils/text');

test('safeInt converts valid number string', () => expect(safeInt('42')).toBe(42));
test('safeInt returns 0 for NaN', () => expect(safeInt('abc')).toBe(0));
test('safeInt returns 0 for negative', () => expect(safeInt('-5')).toBe(0));
test('safeInt returns 0 for null', () => expect(safeInt(null)).toBe(0));
