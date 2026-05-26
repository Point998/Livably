'use strict';

const mockReverseGeocode = jest.fn();

jest.mock('../../src/shared/google/reverseGeocode', () => ({
  reverseGeocodeAddress: mockReverseGeocode,
}));

const { detectRuralMode, checkCrossState, checkDriveTimeCoherence } = require('../../src/shared/validate');

beforeEach(() => {
  jest.clearAllMocks();
});

// ── detectRuralMode ──────────────────────────────────────────────────────────

describe('detectRuralMode', () => {
  test('urban: population > 5000', () => {
    const result = detectRuralMode(10000, 8);
    expect(result.mode).toBe('urban');
    expect(result.label).toBe('Urban');
  });

  test('suburban: population > 1000, drive ≤ 20 min', () => {
    const result = detectRuralMode(3000, 12);
    expect(result.mode).toBe('suburban');
    expect(result.label).toBe('Suburban');
  });

  test('rural: population ≤ 1000', () => {
    const result = detectRuralMode(800, 18);
    expect(result.mode).toBe('rural');
    expect(result.label).toBe('Rural');
  });

  test('rural: population > 1000 but grocery drive > 20 min', () => {
    const result = detectRuralMode(2000, 25);
    expect(result.mode).toBe('rural');
  });

  test('remote: population ≤ 200', () => {
    const result = detectRuralMode(150, 30);
    expect(result.mode).toBe('remote');
    expect(result.label).toBe('Remote');
  });

  test('remote: grocery drive > 45 min overrides population', () => {
    const result = detectRuralMode(3000, 50);
    expect(result.mode).toBe('remote');
  });

  test('null avgDriveMinutes: classifies by population only, never remote', () => {
    const result = detectRuralMode(3000, null);
    expect(result.mode).toBe('suburban');
    expect(result.mode).not.toBe('remote');
  });

  test('null avgDriveMinutes + small population → rural, not remote', () => {
    const result = detectRuralMode(500, null);
    expect(result.mode).toBe('rural');
  });

  test('population exactly 200 → remote', () => {
    const result = detectRuralMode(200, 30);
    expect(result.mode).toBe('remote');
  });

  test('population 201 → not remote from population alone', () => {
    const result = detectRuralMode(201, 20);
    expect(result.mode).not.toBe('remote');
  });

  // 5 test addresses — representative population/drive inputs
  test('Georgetown KY (suburban) → suburban', () => {
    // Suburban KY: tract pop ~2500, grocery ~8 min
    expect(detectRuralMode(2500, 8).mode).toBe('suburban');
  });

  test('Harlan KY (rural Appalachian) → rural', () => {
    // Rural KY: tract pop ~800, grocery ~15 min
    expect(detectRuralMode(800, 15).mode).toBe('rural');
  });

  test('Louisville KY (urban) → urban', () => {
    // Urban KY: tract pop ~8000, grocery ~6 min
    expect(detectRuralMode(8000, 6).mode).toBe('urban');
  });

  test('Bozeman MT (western city) → suburban', () => {
    // Suburban MT: tract pop ~4000, grocery ~10 min
    expect(detectRuralMode(4000, 10).mode).toBe('suburban');
  });

  test('Jeffersonville IN (border city) → suburban', () => {
    // Border suburban: tract pop ~3500, grocery ~9 min
    expect(detectRuralMode(3500, 9).mode).toBe('suburban');
  });
});

// ── checkCrossState ──────────────────────────────────────────────────────────

describe('checkCrossState', () => {
  test('same state → valid', async () => {
    mockReverseGeocode.mockResolvedValue({ state: 'KY', city: 'Georgetown', county: '', zip: '' });
    const result = await checkCrossState({ lat: 38.2, lng: -84.4 }, 'KY');
    expect(result.valid).toBe(true);
    expect(result.resultState).toBe('KY');
  });

  test('different state → invalid (Jeffersonville IN → KY school, PM-001 regression)', async () => {
    mockReverseGeocode.mockResolvedValue({ state: 'KY', city: 'Louisville', county: '', zip: '' });
    const result = await checkCrossState({ lat: 38.2, lng: -85.7 }, 'IN');
    expect(result.valid).toBe(false);
    expect(result.resultState).toBe('KY');
  });

  test('reverse geocode failure → fail open (valid: true)', async () => {
    mockReverseGeocode.mockRejectedValue(new Error('network timeout'));
    const result = await checkCrossState({ lat: 38.2, lng: -84.4 }, 'KY');
    expect(result.valid).toBe(true);
    expect(result.resultState).toBe('');
  });

  test('empty originState → fail open (cannot enforce without origin state)', async () => {
    mockReverseGeocode.mockResolvedValue({ state: 'KY', city: 'Georgetown', county: '', zip: '' });
    const result = await checkCrossState({ lat: 38.2, lng: -84.4 }, '');
    expect(result.valid).toBe(true);
  });

  test('accepts "lat,lng" string format as well as object', async () => {
    mockReverseGeocode.mockResolvedValue({ state: 'IN', city: 'Jeffersonville', county: '', zip: '' });
    const result = await checkCrossState('38.3,-85.7', 'IN');
    expect(result.valid).toBe(true);
    expect(result.resultState).toBe('IN');
  });

  test('reverseGeocode returns empty state string → fail open', async () => {
    mockReverseGeocode.mockResolvedValue({ state: '', city: '', county: '', zip: '' });
    const result = await checkCrossState({ lat: 38.2, lng: -84.4 }, 'KY');
    expect(result.valid).toBe(true);
    expect(result.resultState).toBe('');
  });
});

// ── checkDriveTimeCoherence ──────────────────────────────────────────────────

describe('checkDriveTimeCoherence', () => {
  test('20 min urban → ok', () => {
    const result = checkDriveTimeCoherence(20, 'grocery store', 'urban');
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('');
  });

  test('45 min suburban → ok (boundary: exactly 45 is fine)', () => {
    const result = checkDriveTimeCoherence(45, 'grocery store', 'suburban');
    expect(result.ok).toBe(true);
  });

  test('46 min suburban → not ok', () => {
    const result = checkDriveTimeCoherence(46, 'grocery store', 'suburban');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('grocery store');
  });

  test('50 min urban → not ok, reason includes destination label', () => {
    const result = checkDriveTimeCoherence(50, 'pharmacy', 'urban');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('pharmacy');
  });

  test('50 min rural → ok (rural drive times are always coherent)', () => {
    const result = checkDriveTimeCoherence(50, 'grocery store', 'rural');
    expect(result.ok).toBe(true);
  });

  test('90 min remote → ok', () => {
    const result = checkDriveTimeCoherence(90, 'grocery store', 'remote');
    expect(result.ok).toBe(true);
  });

  test('reason string is empty when ok', () => {
    const result = checkDriveTimeCoherence(10, 'hospital', 'urban');
    expect(result.reason).toBe('');
  });
});
