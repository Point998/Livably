'use strict';

const fs = require('fs');
jest.mock('fs');

let reportStore;
beforeEach(() => {
  jest.resetAllMocks();
  fs.existsSync.mockReturnValue(true);
  fs.readFileSync.mockReturnValue('{}');
  fs.writeFileSync.mockImplementation(() => {});
  fs.mkdirSync.mockImplementation(() => {});
  jest.isolateModules(() => {
    reportStore = require('../../src/services/reportStore');
  });
});

describe('saveReport', () => {
  test('returns an 8-character hex string', () => {
    const id = reportStore.saveReport('100 Main St, Louisville, KY');
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(8);
  });

  test('writes the address to the reports file', () => {
    reportStore.saveReport('100 Main St, Louisville, KY');
    expect(fs.writeFileSync).toHaveBeenCalled();
    const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    const entry = Object.values(written)[0];
    expect(entry.address).toBe('100 Main St, Louisville, KY');
  });
});

describe('getReport', () => {
  test('returns null for unknown ID', () => {
    const result = reportStore.getReport('deadbeef');
    expect(result).toBeNull();
  });

  test('returns saved report entry', () => {
    fs.readFileSync.mockReturnValue(JSON.stringify({
      abc12345: { address: '100 Main St', createdAt: '2026-01-01T00:00:00.000Z', lastAccessed: '2026-01-01T00:00:00.000Z' },
    }));
    const result = reportStore.getReport('abc12345');
    expect(result.address).toBe('100 Main St');
  });
});

describe('updateReportAccess', () => {
  test('updates lastAccessed for known ID', () => {
    fs.readFileSync.mockReturnValue(JSON.stringify({
      abc12345: { address: '100 Main St', createdAt: '2026-01-01T00:00:00.000Z', lastAccessed: '2026-01-01T00:00:00.000Z' },
    }));
    reportStore.updateReportAccess('abc12345');
    expect(fs.writeFileSync).toHaveBeenCalled();
    const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    expect(written.abc12345.lastAccessed).not.toBe('2026-01-01T00:00:00.000Z');
  });

  test('does nothing for unknown ID', () => {
    reportStore.updateReportAccess('unknown');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
