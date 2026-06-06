'use strict';

// FR-058 (NR-003 Phase 1) — spatial cell primitive.
// Maps a coordinate to an H3 cell so that neighboring addresses share one cache
// entry, and exposes that cell's centroid as the single point from which POI
// searches and lifestyle drive times are computed for everyone in the cell.
//
// Pure function: no IO, no API calls. The cache-key seam — swapping H3 for
// another tiling means changing only this file (CONSTRAINT-014: coherence
// primitives live in shared/).

const h3 = require('h3-js');
const { CELL_RESOLUTION_BY_MODE } = require('../utils/constants');

// Accept { lat, lng } or "lat,lng" string (parity with checkCrossState).
function parseLatLng(latLng) {
  if (typeof latLng === 'string') {
    const [lat, lng] = latLng.split(',').map((n) => parseFloat(n.trim()));
    return { lat, lng };
  }
  return { lat: latLng.lat, lng: latLng.lng };
}

// snapToCellAtResolution(latLng, resolution) -> { cellId, resolution, centroid }
// Resolution-parameterized tiling. snapToCell layers mode-driven resolution on top.
function snapToCellAtResolution(latLng, resolution) {
  const { lat, lng } = parseLatLng(latLng);
  const cellId = h3.latLngToCell(lat, lng, resolution);
  const [cLat, cLng] = h3.cellToLatLng(cellId);
  return { cellId, resolution, centroid: { lat: cLat, lng: cLng } };
}

// snapToCell(latLng, mode) -> { cellId, resolution, centroid: { lat, lng } }
// resolution is mode-driven (CONSTRAINT-007 single source). cellId is the H3
// index string at that resolution; centroid is its center point.
function snapToCell(latLng, mode) {
  return snapToCellAtResolution(latLng, CELL_RESOLUTION_BY_MODE[mode]);
}

// FR-058 fetch helpers shared by cell-aware data modules. With a cell, POI
// searches + drive times run from the centroid and key by cellId; without one,
// behavior is per-address (unchanged).
function cellSearchOrigin(originLatLng, cell) {
  return cell ? `${cell.centroid.lat},${cell.centroid.lng}` : originLatLng;
}
function cellDriveOpts(cell) {
  return cell ? { cellId: cell.cellId } : undefined;
}

module.exports = { snapToCell, snapToCellAtResolution, cellSearchOrigin, cellDriveOpts };
