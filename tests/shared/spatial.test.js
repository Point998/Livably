'use strict';

// FR-058 — spatial cell primitive. Pure, no IO. Maps a coordinate to an H3 cell
// whose resolution is chosen by rural mode, plus that cell's centroid (the point
// all addresses in the cell share for POI search + drive-time computation).

const { snapToCell } = require('../../src/shared/spatial');

// Georgetown KY suburban cell (res 8). These two points are exactly 100 m apart
// and verified to share one H3 res-8 cell — the core cache-sharing guarantee.
const NEAR_A = { lat: 38.2101, lng: -84.5447 };
const NEAR_B = { lat: 38.2110, lng: -84.5447 };
// Louisville KY — ~100 km away, a different cell at any resolution.
const FAR = { lat: 38.2527, lng: -85.7585 };

describe('snapToCell', () => {
  test('resolution is chosen by mode (urban 9, suburban 8, rural 6, remote 5)', () => {
    expect(snapToCell(NEAR_A, 'urban').resolution).toBe(9);
    expect(snapToCell(NEAR_A, 'suburban').resolution).toBe(8);
    expect(snapToCell(NEAR_A, 'rural').resolution).toBe(6);
    expect(snapToCell(NEAR_A, 'remote').resolution).toBe(5);
  });

  test('two coordinates ~100 m apart in a suburban cell share one cellId', () => {
    expect(snapToCell(NEAR_A, 'suburban').cellId).toBe(snapToCell(NEAR_B, 'suburban').cellId);
  });

  test('coordinates across a cell boundary get different cellIds', () => {
    expect(snapToCell(NEAR_A, 'suburban').cellId).not.toBe(snapToCell(FAR, 'suburban').cellId);
  });

  test('string "lat,lng" input produces the same result as the object form', () => {
    const fromObj = snapToCell(NEAR_A, 'suburban');
    const fromStr = snapToCell('38.2101,-84.5447', 'suburban');
    expect(fromStr.cellId).toBe(fromObj.cellId);
    expect(fromStr.centroid).toEqual(fromObj.centroid);
    expect(fromStr.resolution).toBe(fromObj.resolution);
  });

  test('centroid is a {lat,lng} object at the center of the returned cell', () => {
    const { cellId, centroid } = snapToCell(NEAR_A, 'suburban');
    const h3 = require('h3-js');
    const [lat, lng] = h3.cellToLatLng(cellId);
    expect(centroid).toEqual({ lat, lng });
  });

  test('the same point at different modes yields different cellIds (no cross-mode collision)', () => {
    const urban = snapToCell(NEAR_A, 'urban').cellId;
    const rural = snapToCell(NEAR_A, 'rural').cellId;
    expect(urban).not.toBe(rural);
  });

  test('all five test addresses snap to a valid cell with a centroid', () => {
    const addresses = [
      { name: 'Georgetown KY', latLng: { lat: 38.209, lng: -84.55 }, mode: 'suburban' },
      { name: 'Harlan KY', latLng: { lat: 36.8429, lng: -83.3216 }, mode: 'rural' },
      { name: 'Louisville KY', latLng: { lat: 38.2527, lng: -85.7585 }, mode: 'urban' },
      { name: 'Bozeman MT', latLng: { lat: 45.6770, lng: -111.0429 }, mode: 'suburban' },
      { name: 'Jeffersonville IN', latLng: { lat: 38.2776, lng: -85.7372 }, mode: 'suburban' },
    ];
    for (const { latLng, mode } of addresses) {
      const cell = snapToCell(latLng, mode);
      expect(typeof cell.cellId).toBe('string');
      expect(cell.cellId.length).toBeGreaterThan(0);
      expect(typeof cell.centroid.lat).toBe('number');
      expect(typeof cell.centroid.lng).toBe('number');
    }
  });
});
