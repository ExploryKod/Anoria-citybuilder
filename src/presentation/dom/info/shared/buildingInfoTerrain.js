/**
 * Terrain / footprint helpers for building info panels.
 */

import {
  footprintFromRecord,
  footprintTilesAsPairs,
} from '../../../../shared/building-identity/index.js';

/**
 * @param {ReadonlyArray<[number, number]> | null | undefined} tiles
 * @returns {string}
 */
export function formatTerrainFootprint(tiles) {
  if (!tiles?.length) return '—';
  return tiles.map(([tx, ty]) => `(${tx},${ty})`).join(', ');
}

/**
 * @param {object | null | undefined} buildingRow
 * @param {number} clickX
 * @param {number} clickY
 */
export function resolveTerrainDisplay(buildingRow, clickX, clickY) {
  const footprint = buildingRow ? footprintFromRecord(buildingRow) : null;
  if (footprint) {
    return {
      anchorX: footprint.anchor.x,
      anchorY: footprint.anchor.y,
      terrainLabel: formatTerrainFootprint(footprintTilesAsPairs(footprint)),
    };
  }
  return {
    anchorX: clickX,
    anchorY: clickY,
    terrainLabel: formatTerrainFootprint([[clickX, clickY]]),
  };
}
