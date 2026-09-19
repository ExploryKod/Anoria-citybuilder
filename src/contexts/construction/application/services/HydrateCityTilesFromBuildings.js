import {
  resolveFootprintDimensions,
  stampBuildingFootprint,
} from '../../domain/policies/FootprintAvailabilityPolicy.js';

function resetTiles(city) {
  if (!city?.tiles) return;
  for (let x = 0; x < city.size; x++) {
    for (let y = 0; y < city.size; y++) {
      const tile = city.tiles[x]?.[y];
      if (!tile) continue;
      tile.terrainId = 'grass';
      tile.buildingId = undefined;
      tile.instanceId = undefined;
      tile.buildingCoord = undefined;
      delete tile.placementRotationStep;
    }
  }
}

/**
 * Stamp Dexie building rows onto an in-memory city grid (placement SoT for the active hamlet).
 *
 * @param {object} city
 * @param {object[]} rows
 * @param {Record<string, { gridSize?: number }>} [assetCatalog]
 */
export function hydrateCityTilesFromRows(city, rows, assetCatalog = {}) {
  if (!city?.tiles || !Array.isArray(rows)) return;

  resetTiles(city);

  for (const row of rows) {
    const x = row.anchorX ?? row.x;
    const y = row.anchorY ?? row.y;
    const instanceId = row.instanceId ?? row.id;
    const type = typeof row.type === 'string' ? row.type : '';
    if (!type || typeof x !== 'number' || typeof y !== 'number' || !instanceId) {
      continue;
    }

    const rotationStep = row.placementRotationStep ?? 0;
    const { width, height } = resolveFootprintDimensions(assetCatalog, type, rotationStep);
    const footprintWidth = Number(row.footprintWidth) || width;
    const footprintHeight = Number(row.footprintHeight) || height;
    stampBuildingFootprint(city, x, y, footprintWidth, type, instanceId, {
      footprintHeight,
      placementRotationStep: rotationStep,
    });
  }
}
